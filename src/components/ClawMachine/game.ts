import Matter from 'matter-js'
import type { Movie } from '../../data/types'
import { createPosterQueue } from '../../lib/posters'
import { randRange, sample } from '../../lib/rng'
import { TIER_COLOR, tierOf } from '../../lib/format'
import { buzz, sfx } from '../../lib/sound'

export type GamePhase =
  | 'idle'
  | 'dropping'
  | 'closing'
  | 'lifting'
  | 'traveling'
  | 'releasing'
  | 'dispensing'
  | 'slipped'

/** Dunia dipakai dalam satuan logis lalu diskalakan ke ukuran canvas. */
const W = 620
const H = 640
const WALL = 14
const FLOOR_Y = 596
const DIVIDER_X = 168
/** Puncak sekat: cukup tinggi untuk menutup lubang, tetap di bawah lintasan derek. */
const DIVIDER_TOP = 292
const RAIL_Y = 74
const CLAW_HOME_X = 95
const CLAW_MIN_X = 214
const CLAW_MAX_X = W - 58
const CLAW_TOP_Y = 124
const CAPSULE_R = 26
const MAX_CAPSULES = 40
const CARRIAGE_SPEED = 3.4

type Capsule = {
  body: Matter.Body
  movie: Movie
}

type PosterImage = { img: HTMLImageElement; cors: boolean; ready: boolean }

export type ClawGameOptions = {
  canvas: HTMLCanvasElement
  pool: Movie[]
  onPhase: (phase: GamePhase) => void
  onPrize: (movie: Movie) => void
  onMiss: () => void
}

export class ClawGame {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private engine: Matter.Engine
  private runner = 0
  private capsules: Capsule[] = []
  private pool: Movie[] = []
  private posters = new Map<string, PosterImage>()
  private enqueuePoster = createPosterQueue(4)
  private opts: ClawGameOptions
  private destroyed = false
  private resizeObserver: ResizeObserver | null = null

  // status derek
  private phase: GamePhase = 'idle'
  private clawX = CLAW_HOME_X
  private clawY = CLAW_TOP_Y
  private openness = 1 // 1 = terbuka penuh, 0 = menjepit
  private targetDepth = 0
  private moveDir = 0
  private held: Capsule | null = null
  /** Kapsul yang baru saja dijatuhkan derek di atas lubang — satu-satunya calon hadiah. */
  private lastReleased: Capsule | null = null
  private constraint: Matter.Constraint | null = null
  private slipAt: number | null = null
  private shake = 0
  private settleUntil = 0
  private dispenseUntil = 0
  private flash = 0
  private reducedMotion = false

  // badan derek yang ikut mendorong kapsul
  private clawHead: Matter.Body
  private fingerL: Matter.Body
  private fingerR: Matter.Body

  constructor(opts: ClawGameOptions) {
    this.opts = opts
    this.canvas = opts.canvas
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D tidak tersedia')
    this.ctx = ctx

    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0016 } })

    const wallOpts: Matter.IChamferableBodyDefinition = { isStatic: true, friction: 0.4, restitution: 0.1 }
    Matter.Composite.add(this.engine.world, [
      // dinding kabin
      Matter.Bodies.rectangle(WALL / 2, H / 2, WALL, H, wallOpts),
      Matter.Bodies.rectangle(W - WALL / 2, H / 2, WALL, H, wallOpts),
      // lantai tumpukan (berhenti di tepi lubang hadiah), dibuat tebal agar
      // kapsul di dasar tumpukan tidak menembusnya
      Matter.Bodies.rectangle((DIVIDER_X + W) / 2, FLOOR_Y + 20, W - DIVIDER_X, 40, wallOpts),
      // sekat yang memisahkan tumpukan dari lubang hadiah
      Matter.Bodies.rectangle(
        DIVIDER_X,
        (DIVIDER_TOP + FLOOR_Y) / 2,
        12,
        FLOOR_Y - DIVIDER_TOP,
        wallOpts,
      ),
    ])

    this.clawHead = Matter.Bodies.rectangle(this.clawX, this.clawY, 52, 16, {
      isStatic: true,
      friction: 0.6,
    })
    this.fingerL = Matter.Bodies.rectangle(this.clawX - 18, this.clawY + 26, 9, 46, {
      isStatic: true,
      friction: 0.9,
      chamfer: { radius: 4 },
    })
    this.fingerR = Matter.Bodies.rectangle(this.clawX + 18, this.clawY + 26, 9, 46, {
      isStatic: true,
      friction: 0.9,
      chamfer: { radius: 4 },
    })
    Matter.Composite.add(this.engine.world, [this.clawHead, this.fingerL, this.fingerR])

    this.setPool(opts.pool)
    this.attachResize()
    this.loop = this.loop.bind(this)
    this.runner = requestAnimationFrame(this.loop)
  }

  // ---------- siklus hidup ----------

  private attachResize() {
    const fit = () => this.fitCanvas()
    fit()
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(fit)
      this.resizeObserver.observe(this.canvas)
    }
    window.addEventListener('resize', fit)
    this.detachResize = () => window.removeEventListener('resize', fit)
  }

  private detachResize: () => void = () => {}

  private fitCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(rect.width * dpr)
    this.canvas.height = Math.round(rect.height * dpr)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.runner)
    this.resizeObserver?.disconnect()
    this.detachResize()
    sfx.stopMotor()
    Matter.Composite.clear(this.engine.world, false)
    Matter.Engine.clear(this.engine)
  }

  // ---------- isi kabin ----------

  /**
   * Kapsul di kabin adalah sampel acak dari pool yang sudah difilter, dan
   * kapsul yang tercapit itulah hadiahnya — jadi filter benar-benar dihormati
   * tanpa perlu mencurangi hasil physics.
   */
  setPool(pool: Movie[]) {
    this.pool = pool
    for (const c of this.capsules) Matter.Composite.remove(this.engine.world, c.body)
    this.capsules = []
    if (pool.length === 0) return

    this.settleUntil = performance.now() + 2600
    const chosen = sample(pool, Math.min(MAX_CAPSULES, pool.length))
    chosen.forEach((movie, i) => this.addCapsule(movie, i))
  }

  private addCapsule(movie: Movie, index: number) {
    const spanL = DIVIDER_X + CAPSULE_R + 12
    const spanR = W - WALL - CAPSULE_R - 12
    const cols = 7
    const step = (spanR - spanL) / (cols - 1)
    const x = spanL + (index % cols) * step + randRange(-5, 5)
    // ditebar di atas kabin dalam kisi supaya jatuh dan menumpuk sendiri
    const y = 240 - Math.floor(index / cols) * (CAPSULE_R * 2 + 8)
    const body = Matter.Bodies.circle(x, y, CAPSULE_R, {
      restitution: 0.24,
      friction: 0.32,
      frictionAir: 0.008,
      density: 0.0012,
      label: movie.id,
    })
    Matter.Composite.add(this.engine.world, body)
    this.capsules.push({ body, movie })
    this.loadPoster(movie)
  }

  private loadPoster(movie: Movie) {
    if (this.posters.has(movie.id)) return
    void this.enqueuePoster(movie).then((hit) => {
      if (!hit || this.destroyed) return
      // crossOrigin dulu supaya kartu bagikan tidak mencemari canvas;
      // kalau host-nya menolak, muat ulang tanpa itu demi tampilan saja.
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const record: PosterImage = { img, cors: true, ready: false }
      img.onload = () => {
        record.ready = true
      }
      img.onerror = () => {
        const plain = new Image()
        plain.onload = () => {
          record.img = plain
          record.cors = false
          record.ready = true
        }
        plain.src = hit.url
      }
      img.src = hit.url
      this.posters.set(movie.id, record)
    })
  }

  getPoster(id: string): PosterImage | null {
    const p = this.posters.get(id)
    return p && p.ready ? p : null
  }

  // ---------- masukan ----------

  setMove(dir: number) {
    if (this.phase !== 'idle') return
    if (dir !== 0 && this.moveDir === 0) sfx.startMotor()
    if (dir === 0 && this.moveDir !== 0) sfx.stopMotor()
    this.moveDir = dir
  }

  canDrop() {
    return this.phase === 'idle' && this.capsules.length > 0
  }

  drop() {
    if (!this.canDrop()) return
    this.moveDir = 0
    sfx.stopMotor()
    this.targetDepth = this.computeDepth()
    this.setPhase('dropping')
    sfx.startMotor()
  }

  /** Turun tepat di atas tumpukan di bawah derek, bukan selalu ke dasar. */
  private computeDepth(): number {
    let topY = FLOOR_Y
    for (const c of this.capsules) {
      if (Math.abs(c.body.position.x - this.clawX) < CAPSULE_R + 16) {
        topY = Math.min(topY, c.body.position.y)
      }
    }
    return Math.min(FLOOR_Y - 72, topY - 54)
  }

  private setPhase(phase: GamePhase) {
    this.phase = phase
    this.opts.onPhase(phase)
  }

  // ---------- mesin status ----------

  private step() {
    switch (this.phase) {
      case 'idle': {
        // Setelah mengantar hadiah derek berhenti di atas lubang; luncurkan
        // kembali ke tepi arena supaya tekan tombol pertama tidak membuatnya melompat.
        if (this.clawX < CLAW_MIN_X && performance.now() >= this.settleUntil) {
          this.clawX += (CLAW_MIN_X - this.clawX) * 0.12
          if (CLAW_MIN_X - this.clawX < 0.6) this.clawX = CLAW_MIN_X
        }
        if (this.moveDir !== 0) {
          this.clawX = Math.max(
            CLAW_MIN_X,
            Math.min(CLAW_MAX_X, this.clawX + this.moveDir * CARRIAGE_SPEED),
          )
        }
        this.openness = 1
        this.clawY += (CLAW_TOP_Y - this.clawY) * 0.18
        break
      }
      case 'dropping': {
        this.clawY += 4.2
        if (this.clawY >= this.targetDepth) {
          this.clawY = this.targetDepth
          sfx.stopMotor()
          this.setPhase('closing')
        }
        break
      }
      case 'closing': {
        this.openness -= 0.055
        if (this.openness <= 0.08) {
          this.openness = 0.08
          this.attemptGrab()
          sfx.clamp()
          buzz(18)
          sfx.startMotor()
          this.setPhase('lifting')
        }
        break
      }
      case 'lifting': {
        this.clawY -= 3.1
        // fase angkat memakai paruh pertama skala progres (0 -> 0.5)
        const climbed = (this.targetDepth - this.clawY) / Math.max(1, this.targetDepth - CLAW_TOP_Y)
        this.checkSlip(Math.min(0.5, Math.max(0, climbed) * 0.5))
        if (this.clawY <= CLAW_TOP_Y) {
          this.clawY = CLAW_TOP_Y
          this.setPhase('traveling')
        }
        break
      }
      case 'traveling': {
        const startX = CLAW_MAX_X
        this.clawX += (CLAW_HOME_X - this.clawX) * 0.055
        // fase geser memakai paruh kedua (0.5 -> 1)
        const moved = (startX - this.clawX) / Math.max(1, startX - CLAW_HOME_X)
        this.checkSlip(0.5 + Math.min(0.5, Math.max(0, moved) * 0.5))
        if (Math.abs(this.clawX - CLAW_HOME_X) < 2.5) {
          this.clawX = CLAW_HOME_X
          sfx.stopMotor()
          this.setPhase('releasing')
        }
        break
      }
      case 'releasing': {
        this.openness += 0.06
        if (this.openness >= 1) {
          this.openness = 1
          // hadiah dilaporkan oleh pemantau jatuh saat kapsul melewati lubang
          this.lastReleased = this.held
          this.releaseHeld()
          if (this.lastReleased) {
            this.dispenseUntil = performance.now() + 2500
            this.setPhase('dispensing')
          } else {
            this.setPhase('idle')
          }
        }
        break
      }
      case 'dispensing': {
        // Kapsul sedang meluncur ke lubang; hadiah dilaporkan pemantau jatuh.
        // Batas waktu menjaga mesin tidak macet kalau kapsul tersangkut.
        if (this.lastReleased == null || performance.now() > this.dispenseUntil) {
          this.lastReleased = null
          this.setPhase('idle')
        }
        break
      }
      case 'slipped': {
        this.openness += 0.07
        this.clawY += (CLAW_TOP_Y - this.clawY) * 0.16
        this.clawX += (CLAW_HOME_X - this.clawX) * 0.05
        if (this.openness >= 1 && Math.abs(this.clawX - CLAW_HOME_X) < 6) {
          this.openness = 1
          sfx.stopMotor()
          this.setPhase('idle')
        }
        break
      }
    }

    this.syncClawBodies()
    this.trackFallenPrize()
  }

  /**
   * Cengkeraman dinilai dari seberapa tepat bidikannya, lalu diundi. Kalau undian
   * gagal, waktu lepasnya dijadwalkan di tengah perjalanan — persis seperti
   * mesin capit sungguhan.
   */
  private attemptGrab() {
    const tipY = this.clawY + 44
    let best: Capsule | null = null
    let bestDist = Infinity
    for (const c of this.capsules) {
      const dx = c.body.position.x - this.clawX
      const dy = c.body.position.y - tipY
      const dist = Math.hypot(dx, dy)
      if (dist < bestDist) {
        bestDist = dist
        best = c
      }
    }
    if (!best || bestDist > CAPSULE_R + 26) {
      this.slipAt = null
      return
    }

    const accuracy = 1 - Math.min(1, bestDist / (CAPSULE_R + 26))
    const holdChance = 0.34 + accuracy * 0.42
    const holds = Math.random() < holdChance

    this.held = best
    this.constraint = Matter.Constraint.create({
      bodyA: this.clawHead,
      bodyB: best.body,
      pointA: { x: 0, y: 30 },
      length: 22,
      stiffness: 0.85,
      damping: 0.25,
    })
    Matter.Composite.add(this.engine.world, this.constraint)
    // 0 = lepas saat baru terangkat, 1 = lepas tepat sebelum lubang
    this.slipAt = holds ? null : Math.random()
  }

  private checkSlip(progress: number) {
    if (this.slipAt == null || !this.held) return
    if (progress < this.slipAt) return
    this.slipAt = null
    this.releaseHeld()
    sfx.slip()
    buzz([12, 40, 12])
    this.shake = this.reducedMotion ? 0 : 7
    this.opts.onMiss()
    this.setPhase('slipped')
  }

  private releaseHeld() {
    if (this.constraint) {
      Matter.Composite.remove(this.engine.world, this.constraint)
      this.constraint = null
    }
    this.held = null
  }

  /** Kapsul yang jatuh melewati dasar lubang dihitung sebagai hadiah. */
  private trackFallenPrize() {
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i]
      if (c.body.position.y < H + 70) continue

      // Selama kabin masih menata diri, kapsul yang lolos bukan hadiah —
      // kembalikan ke tumpukan supaya tidak ada hadiah gratis.
      if (performance.now() < this.settleUntil || c !== this.lastReleased) {
        Matter.Body.setPosition(c.body, {
          x: randRange(DIVIDER_X + CAPSULE_R + 20, W - WALL - CAPSULE_R - 20),
          y: 140,
        })
        Matter.Body.setVelocity(c.body, { x: 0, y: 0 })
        Matter.Body.setAngularVelocity(c.body, 0)
        continue
      }

      this.lastReleased = null
      this.capsules.splice(i, 1)
      Matter.Composite.remove(this.engine.world, c.body)
      this.flash = this.reducedMotion ? 0 : 1
      sfx.drop()
      buzz([20, 30, 60])
      this.opts.onPrize(c.movie)
      // isi ulang kabin supaya jumlah kapsul tetap terasa penuh
      const used = new Set(this.capsules.map((x) => x.movie.id))
      const refill = this.pool.filter((m) => !used.has(m.id) && m.id !== c.movie.id)
      if (refill.length > 0) this.addCapsule(sample(refill, 1)[0], 0)
    }
  }

  private syncClawBodies() {
    const spread = 14 + this.openness * 16
    const angle = (1 - this.openness) * -0.5
    Matter.Body.setPosition(this.clawHead, { x: this.clawX, y: this.clawY })
    Matter.Body.setPosition(this.fingerL, { x: this.clawX - spread, y: this.clawY + 26 })
    Matter.Body.setAngle(this.fingerL, -angle)
    Matter.Body.setPosition(this.fingerR, { x: this.clawX + spread, y: this.clawY + 26 })
    Matter.Body.setAngle(this.fingerR, angle)
  }

  // ---------- perulangan ----------

  private lastTime = 0

  private loop(time: number) {
    if (this.destroyed) return
    const dt = this.lastTime === 0 ? 16.7 : Math.min(32, time - this.lastTime)
    this.lastTime = time
    this.step()
    Matter.Engine.update(this.engine, dt)
    this.render()
    this.runner = requestAnimationFrame(this.loop)
  }

  // ---------- gambar ----------

  private render() {
    const ctx = this.ctx
    const cw = this.canvas.width
    const ch = this.canvas.height
    if (cw === 0 || ch === 0) return

    const scale = Math.min(cw / W, ch / H)
    const offX = (cw - W * scale) / 2
    const offY = (ch - H * scale) / 2

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cw, ch)

    const shakeX = this.shake > 0 ? randRange(-this.shake, this.shake) : 0
    const shakeY = this.shake > 0 ? randRange(-this.shake, this.shake) : 0
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.4)
    ctx.setTransform(scale, 0, 0, scale, offX + shakeX, offY + shakeY)

    this.drawCabin(ctx)
    this.drawChuteBack(ctx)
    for (const c of this.capsules) this.drawBall(ctx, c)
    // Dinding depan tabung digambar setelah bola, supaya bola yang masuk
    // benar-benar terlihat hilang ke dalam tabung.
    this.drawChuteFront(ctx)
    this.drawClaw(ctx)
    this.drawGlass(ctx)

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.3})`
      ctx.fillRect(0, 0, W, H)
      this.flash = Math.max(0, this.flash - 0.06)
    }
  }

  /** Dinding dan lantai bagian dalam kabin, plus rel derek. */
  private drawCabin(ctx: CanvasRenderingContext2D) {
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#549087')
    bg.addColorStop(0.55, '#3f736a')
    bg.addColorStop(1, '#2f5952')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // lantai kabin sedikit lebih gelap, dengan garis tepi terang
    const floor = ctx.createLinearGradient(0, FLOOR_Y, 0, H)
    floor.addColorStop(0, '#356158')
    floor.addColorStop(1, '#264A43')
    ctx.fillStyle = floor
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(0, FLOOR_Y, W, 3)

    // rel derek
    ctx.fillStyle = '#eef3ec'
    ctx.beginPath()
    ctx.roundRect(WALL + 4, RAIL_Y - 5, W - (WALL + 4) * 2, 10, 5)
    ctx.fill()
    ctx.fillStyle = 'rgba(21,42,38,0.16)'
    ctx.beginPath()
    ctx.roundRect(WALL + 4, RAIL_Y + 1, W - (WALL + 4) * 2, 4, 2)
    ctx.fill()
  }

  private get chuteGeom() {
    const x0 = WALL + 2
    const x1 = DIVIDER_X + 6
    return { x0, x1, cx: (x0 + x1) / 2, rx: (x1 - x0) / 2, ry: 16 }
  }

  /** Rongga gelap dan bibir belakang tabung hadiah. */
  private drawChuteBack(ctx: CanvasRenderingContext2D) {
    const { x0, x1, cx, rx, ry } = this.chuteGeom

    ctx.fillStyle = '#1b3832'
    ctx.beginPath()
    ctx.ellipse(cx, DIVIDER_TOP, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(x0, DIVIDER_TOP, x1 - x0, H - DIVIDER_TOP)

    // bibir belakang yang terang
    ctx.strokeStyle = '#b6e06a'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.ellipse(cx, DIVIDER_TOP, rx, ry, 0, Math.PI, 0)
    ctx.stroke()
  }

  /** Dinding depan tabung: menutupi apa pun yang sudah jatuh ke dalamnya. */
  private drawChuteFront(ctx: CanvasRenderingContext2D) {
    const { x0, x1, cx, rx, ry } = this.chuteGeom

    const body = ctx.createLinearGradient(x0, 0, x1, 0)
    body.addColorStop(0, '#5d9026')
    body.addColorStop(0.3, '#8cc63f')
    body.addColorStop(0.68, '#aeda63')
    body.addColorStop(1, '#5d9026')

    ctx.beginPath()
    ctx.moveTo(x1, DIVIDER_TOP)
    ctx.ellipse(cx, DIVIDER_TOP, rx, ry, 0, 0, Math.PI)
    ctx.lineTo(x0, H)
    ctx.lineTo(x1, H)
    ctx.closePath()
    ctx.fillStyle = body
    ctx.fill()

    // bibir depan
    ctx.strokeStyle = '#b6e06a'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.ellipse(cx, DIVIDER_TOP, rx, ry, 0, 0, Math.PI)
    ctx.stroke()

    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = '600 17px Fredoka, Nunito, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('HADIAH', cx, DIVIDER_TOP + 70)
    ctx.restore()
  }

  /** Bola mainan putih mengkilap dengan pita warna tier dan jendela poster. */
  private drawBall(ctx: CanvasRenderingContext2D, c: Capsule) {
    const { x, y } = c.body.position
    const r = CAPSULE_R
    const color = TIER_COLOR[tierOf(c.movie.rank)]
    const poster = this.getPoster(c.movie.id)

    ctx.save()

    // bayangan lembut di bawah bola
    ctx.beginPath()
    ctx.ellipse(x, y + r * 0.86, r * 0.78, r * 0.24, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(18,44,40,0.26)'
    ctx.fill()

    ctx.translate(x, y)
    ctx.rotate(c.body.angle)

    // badan bola
    const shell = ctx.createRadialGradient(-r * 0.36, -r * 0.42, r * 0.08, 0, 0, r)
    shell.addColorStop(0, '#ffffff')
    shell.addColorStop(0.66, '#f4f6f1')
    shell.addColorStop(1, '#ccd5cd')
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = shell
    ctx.fill()

    // pita warna melintang
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = color
    ctx.fillRect(-r, -r * 0.44, r * 2, r * 0.88)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(-r, r * 0.3, r * 2, r * 0.14)
    ctx.restore()

    // jendela poster di tengah
    const pr = r * 0.6
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, pr, 0, Math.PI * 2)
    ctx.clip()
    if (poster) {
      const img = poster.img
      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
      const dw = pr * 2
      const dh = dw / (aspect || 0.675)
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    } else {
      ctx.fillStyle = '#23423d'
      ctx.fillRect(-pr, -pr, pr * 2, pr * 2)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '600 15px Fredoka, Nunito, sans-serif'
      ctx.fillText(String(c.movie.rank), 0, 1)
    }
    ctx.restore()

    // cincin krem di sekeliling jendela
    ctx.beginPath()
    ctx.arc(0, 0, pr, 0, Math.PI * 2)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fdfbf3'
    ctx.stroke()

    // kilau
    ctx.beginPath()
    ctx.ellipse(-r * 0.42, -r * 0.48, r * 0.24, r * 0.14, -0.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fill()

    // garis tepi tipis
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(28,58,52,0.22)'
    ctx.stroke()

    ctx.restore()
  }

  private drawClaw(ctx: CanvasRenderingContext2D) {
    const x = this.clawX
    const y = this.clawY

    // batang penggantung
    ctx.strokeStyle = '#c3d0d6'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(x, RAIL_Y)
    ctx.lineTo(x, y - 4)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - 1.4, RAIL_Y)
    ctx.lineTo(x - 1.4, y - 4)
    ctx.stroke()

    // kereta motor di rel
    const carriage = ctx.createLinearGradient(0, RAIL_Y - 16, 0, RAIL_Y + 8)
    carriage.addColorStop(0, '#6fa6d8')
    carriage.addColorStop(1, '#3b6fab')
    ctx.fillStyle = carriage
    ctx.beginPath()
    ctx.roundRect(x - 25, RAIL_Y - 17, 50, 26, 9)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.roundRect(x - 19, RAIL_Y - 13, 38, 6, 3)
    ctx.fill()

    // kepala capit
    const head = ctx.createLinearGradient(0, y - 12, 0, y + 12)
    head.addColorStop(0, '#e6eef3')
    head.addColorStop(0.5, '#bccbd4')
    head.addColorStop(1, '#8fa4b1')
    ctx.fillStyle = head
    ctx.beginPath()
    ctx.roundRect(x - 31, y - 12, 62, 24, 11)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.beginPath()
    ctx.roundRect(x - 24, y - 8, 48, 6, 3)
    ctx.fill()

    // jari capit
    const spread = 13 + this.openness * 15
    const tilt = (1 - this.openness) * 0.55
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(x + side * spread, y + 8)
      ctx.rotate(side * tilt)
      const g = ctx.createLinearGradient(-6, 0, 6, 0)
      g.addColorStop(0, '#eaf1f5')
      g.addColorStop(0.55, '#bccbd4')
      g.addColorStop(1, '#8398a6')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(-7, 0)
      ctx.lineTo(7, 0)
      ctx.quadraticCurveTo(8, 27, side * 5.5, 42)
      ctx.quadraticCurveTo(side * 1.5, 47, side * -2, 42)
      ctx.quadraticCurveTo(-8, 27, -7, 0)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(70,100,116,0.35)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }
  }

  /** Pantulan kaca: dua sapuan putih tipis, tanpa glow. */
  private drawGlass(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.globalAlpha = 0.09
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(70, 0)
    ctx.lineTo(178, 0)
    ctx.lineTo(28, H)
    ctx.lineTo(-80, H)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(228, 0)
    ctx.lineTo(262, 0)
    ctx.lineTo(112, H)
    ctx.lineTo(78, H)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // bayangan dalam di tepi kabin
    ctx.save()
    const vign = ctx.createLinearGradient(0, 0, 0, 110)
    vign.addColorStop(0, 'rgba(12,32,29,0.35)')
    vign.addColorStop(1, 'rgba(12,32,29,0)')
    ctx.fillStyle = vign
    ctx.fillRect(0, 0, W, 110)
    ctx.restore()
  }
}
