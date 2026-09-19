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
const H = 720
const WALL = 14
const FLOOR_Y = 640
const DIVIDER_X = 152
/** Puncak sekat: cukup tinggi untuk menutup lubang, tetap di bawah lintasan derek. */
const DIVIDER_TOP = 300
const RAIL_Y = 96
const CLAW_HOME_X = 82
const CLAW_MIN_X = 198
const CLAW_MAX_X = W - 58
const CLAW_TOP_Y = 150
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
        if (this.clawX < CLAW_MIN_X) {
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

    this.drawCabinet(ctx)
    for (const c of this.capsules) this.drawCapsule(ctx, c)
    this.drawClaw(ctx)
    this.drawGlass(ctx)

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`
      ctx.fillRect(0, 0, W, H)
      this.flash = Math.max(0, this.flash - 0.06)
    }
  }

  private drawCabinet(ctx: CanvasRenderingContext2D) {
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#160d2b')
    bg.addColorStop(0.55, '#0d0820')
    bg.addColorStop(1, '#06040f')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // grid perspektif di lantai
    ctx.save()
    ctx.strokeStyle = 'rgba(236,72,153,0.16)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 12; i++) {
      const x = WALL + ((W - WALL * 2) / 12) * i
      ctx.beginPath()
      ctx.moveTo(x, FLOOR_Y)
      ctx.lineTo(W / 2 + (x - W / 2) * 0.55, FLOOR_Y - 120)
      ctx.stroke()
    }
    for (let i = 1; i <= 5; i++) {
      const y = FLOOR_Y - (120 / 5) * i
      ctx.beginPath()
      ctx.moveTo(WALL, y)
      ctx.lineTo(W - WALL, y)
      ctx.globalAlpha = 1 - i / 6
      ctx.stroke()
    }
    ctx.restore()

    // lubang hadiah
    const chute = ctx.createLinearGradient(0, DIVIDER_TOP, 0, H)
    chute.addColorStop(0, 'rgba(0,0,0,0.2)')
    chute.addColorStop(1, '#000')
    ctx.fillStyle = chute
    ctx.fillRect(WALL, DIVIDER_TOP, DIVIDER_X - WALL - 6, H - DIVIDER_TOP)
    ctx.strokeStyle = 'rgba(56,189,248,0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(WALL, DIVIDER_TOP, DIVIDER_X - WALL - 6, H - DIVIDER_TOP)
    ctx.save()
    ctx.fillStyle = 'rgba(56,189,248,0.75)'
    ctx.font = '700 15px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('HADIAH', (WALL + DIVIDER_X - 6) / 2, DIVIDER_TOP + 30)
    ctx.restore()

    // sekat + lantai
    ctx.fillStyle = '#1b1235'
    ctx.fillRect(DIVIDER_X - 6, DIVIDER_TOP, 12, FLOOR_Y - DIVIDER_TOP + 40)
    ctx.fillStyle = '#231645'
    ctx.fillRect(DIVIDER_X, FLOOR_Y, W - DIVIDER_X - WALL, 20)

    // rel derek
    ctx.fillStyle = '#2a1b4d'
    ctx.fillRect(WALL, RAIL_Y - 8, W - WALL * 2, 10)
    ctx.strokeStyle = 'rgba(244,114,182,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(WALL, RAIL_Y + 3)
    ctx.lineTo(W - WALL, RAIL_Y + 3)
    ctx.stroke()
  }

  private drawCapsule(ctx: CanvasRenderingContext2D, c: Capsule) {
    const { x, y } = c.body.position
    const r = CAPSULE_R
    const tier = tierOf(c.movie.rank)
    const color = TIER_COLOR[tier]
    const poster = this.getPoster(c.movie.id)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(c.body.angle)

    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.clip()

    if (poster) {
      const img = poster.img
      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
      const dw = r * 2
      const dh = dw / (aspect || 0.675)
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    } else {
      // kartu gaya sendiri: dipakai selagi poster dimuat atau kalau gagal
      const g = ctx.createLinearGradient(-r, -r, r, r)
      g.addColorStop(0, color)
      g.addColorStop(1, '#1b1035')
      ctx.fillStyle = g
      ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.fillStyle = 'rgba(8,4,15,0.62)'
      ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.fillStyle = '#fff'
      ctx.font = '700 15px "Space Grotesk", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const initials = c.movie.title
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] ?? '')
        .join('')
      ctx.fillText(initials.toUpperCase(), 0, 1)
    }
    ctx.restore()

    // kaca kapsul + pinggiran tier
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(-r * 0.32, -r * 0.36, r * 0.42, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fill()

    ctx.restore()
  }

  private drawClaw(ctx: CanvasRenderingContext2D) {
    const x = this.clawX
    const y = this.clawY

    // kabel
    ctx.strokeStyle = '#7c6bb0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, RAIL_Y)
    ctx.lineTo(x, y)
    ctx.stroke()

    // kereta di rel
    ctx.fillStyle = '#3b2a63'
    ctx.fillRect(x - 22, RAIL_Y - 12, 44, 16)
    ctx.strokeStyle = 'rgba(244,114,182,0.8)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x - 22, RAIL_Y - 12, 44, 16)

    // kepala
    ctx.save()
    ctx.shadowColor = 'rgba(236,72,153,0.7)'
    ctx.shadowBlur = 14
    const head = ctx.createLinearGradient(x - 26, y - 8, x + 26, y + 8)
    head.addColorStop(0, '#d9d4ec')
    head.addColorStop(0.5, '#8b82b8')
    head.addColorStop(1, '#5a5186')
    ctx.fillStyle = head
    ctx.beginPath()
    ctx.roundRect(x - 26, y - 9, 52, 18, 5)
    ctx.fill()
    ctx.restore()

    // jari
    const spread = 14 + this.openness * 16
    const tilt = (1 - this.openness) * 0.5
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(x + side * spread, y + 6)
      ctx.rotate(side * tilt)
      const g = ctx.createLinearGradient(-5, 0, 5, 0)
      g.addColorStop(0, '#cfc9e6')
      g.addColorStop(1, '#6f679c')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(-4.5, 0)
      ctx.lineTo(4.5, 0)
      ctx.lineTo(2.5, 42)
      ctx.lineTo(-2.5, 42)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }
  }

  private drawGlass(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(148,163,255,0.05)'
    ctx.beginPath()
    ctx.moveTo(60, 0)
    ctx.lineTo(190, 0)
    ctx.lineTo(70, H)
    ctx.lineTo(-60, H)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(300, 0)
    ctx.lineTo(340, 0)
    ctx.lineTo(220, H)
    ctx.lineTo(180, H)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    ctx.strokeStyle = 'rgba(129,140,248,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(WALL / 2, 2, W - WALL, H - 4)
  }
}
