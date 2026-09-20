import Matter from 'matter-js'

export type PlinkoOptions = {
  canvas: HTMLCanvasElement
  onLanded: (slot: number) => void
  onTick: () => void
}

export const SLOTS = 9

const W = 420
const H = 560
const WALL = 10
const PEG_TOP = 96
const PEG_ROWS = 9
const PEG_COLS = 9
const MARGIN = 38
const SLOT_TOP = 452
const FLOOR_Y = 508
const BALL_R = 9
/** Kalau bola tersangkut, hasilnya tetap harus keluar. */
const SETTLE_TIMEOUT_MS = 7000

/**
 * Papan Plinko.
 *
 * Berbeda dari Case Opening dan Roda Putar, di sini pemenang TIDAK ditentukan
 * lebih dulu: physics yang memutuskan slot mana yang kejatuhan bola, dan film
 * pada slot itulah hadiahnya. Justru itu inti permainannya.
 */
export class PlinkoBoard {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private engine: Matter.Engine
  private raf = 0
  private destroyed = false
  private opts: PlinkoOptions

  private pegs: Matter.Body[] = []
  private ball: Matter.Body | null = null
  private droppedAt = 0
  private lastTickRow = -1
  private lastTime = 0

  private slotLabels: string[] = []
  private highlight: number | null = null
  dropX = 0.5

  constructor(opts: PlinkoOptions) {
    this.opts = opts
    this.canvas = opts.canvas
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D tidak tersedia')
    this.ctx = ctx

    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0013 } })

    const staticOpts: Matter.IChamferableBodyDefinition = { isStatic: true }
    Matter.Composite.add(this.engine.world, [
      Matter.Bodies.rectangle(WALL / 2, H / 2, WALL, H, staticOpts),
      Matter.Bodies.rectangle(W - WALL / 2, H / 2, WALL, H, staticOpts),
      Matter.Bodies.rectangle(W / 2, FLOOR_Y + 12, W, 24, { ...staticOpts, friction: 0.9 }),
    ])

    const gap = (W - MARGIN * 2) / (PEG_COLS - 1)
    const rowGap = (SLOT_TOP - 40 - PEG_TOP) / (PEG_ROWS - 1)
    for (let r = 0; r < PEG_ROWS; r++) {
      const odd = r % 2 === 1
      const n = odd ? PEG_COLS - 1 : PEG_COLS
      for (let i = 0; i < n; i++) {
        const x = MARGIN + i * gap + (odd ? gap / 2 : 0)
        const y = PEG_TOP + r * rowGap
        this.pegs.push(
          Matter.Bodies.circle(x, y, 4.5, { isStatic: true, restitution: 0.55, friction: 0.02 }),
        )
      }
    }
    Matter.Composite.add(this.engine.world, this.pegs)

    const slotW = W / SLOTS
    for (let i = 1; i < SLOTS; i++) {
      Matter.Composite.add(
        this.engine.world,
        Matter.Bodies.rectangle(i * slotW, (SLOT_TOP + FLOOR_Y) / 2, 4, FLOOR_Y - SLOT_TOP, {
          isStatic: true,
        }),
      )
    }

    this.loop = this.loop.bind(this)
    this.fit()
    this.raf = requestAnimationFrame(this.loop)
  }

  private fit() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = rect.width || W
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(((width * H) / W) * dpr)
  }

  setSlotLabels(labels: string[]) {
    this.slotLabels = labels
  }

  setDropX(fraction: number) {
    this.dropX = Math.max(0.06, Math.min(0.94, fraction))
  }

  get isBusy() {
    return this.ball != null
  }

  drop() {
    if (this.ball) return
    this.highlight = null
    this.lastTickRow = -1
    const x = WALL + BALL_R + this.dropX * (W - (WALL + BALL_R) * 2)
    this.ball = Matter.Bodies.circle(x, 56, BALL_R, {
      restitution: 0.42,
      friction: 0.008,
      frictionAir: 0.012,
      density: 0.004,
    })
    Matter.Composite.add(this.engine.world, this.ball)
    this.droppedAt = performance.now()
  }

  private resolveLanding() {
    const ball = this.ball
    if (!ball) return
    const slotW = W / SLOTS
    const slot = Math.max(0, Math.min(SLOTS - 1, Math.floor(ball.position.x / slotW)))
    Matter.Composite.remove(this.engine.world, ball)
    this.ball = null
    this.highlight = slot
    this.opts.onLanded(slot)
  }

  private step() {
    const ball = this.ball
    if (!ball) return

    const rowGap = (SLOT_TOP - 40 - PEG_TOP) / (PEG_ROWS - 1)
    const row = Math.floor((ball.position.y - PEG_TOP) / rowGap)
    if (row !== this.lastTickRow && row >= 0 && row < PEG_ROWS) {
      this.lastTickRow = row
      this.opts.onTick()
    }

    const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
    const settled = ball.position.y > SLOT_TOP + 12 && speed < 0.35
    const timedOut = performance.now() - this.droppedAt > SETTLE_TIMEOUT_MS
    if (settled || timedOut) this.resolveLanding()
  }

  private loop(time: number) {
    if (this.destroyed) return
    const dt = this.lastTime === 0 ? 16.7 : Math.min(32, time - this.lastTime)
    this.lastTime = time
    Matter.Engine.update(this.engine, dt)
    this.step()
    this.render()
    this.raf = requestAnimationFrame(this.loop)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    Matter.Composite.clear(this.engine.world, false)
    Matter.Engine.clear(this.engine)
  }

  private render() {
    const ctx = this.ctx
    const cw = this.canvas.width
    if (cw === 0) return

    const scale = cw / W
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cw, this.canvas.height)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#141416')
    bg.addColorStop(1, '#000000')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const dropPx = WALL + BALL_R + this.dropX * (W - (WALL + BALL_R) * 2)
    ctx.strokeStyle = 'rgba(41,151,255,0.35)'
    ctx.setLineDash([3, 6])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(dropPx, 30)
    ctx.lineTo(dropPx, SLOT_TOP)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#2997ff'
    ctx.beginPath()
    ctx.moveTo(dropPx - 7, 22)
    ctx.lineTo(dropPx + 7, 22)
    ctx.lineTo(dropPx, 34)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#48484a'
    for (const peg of this.pegs) {
      ctx.beginPath()
      ctx.arc(peg.position.x, peg.position.y, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }

    const slotW = W / SLOTS
    for (let i = 0; i < SLOTS; i++) {
      const isHit = this.highlight === i
      ctx.fillStyle = isHit ? 'rgba(41,151,255,0.22)' : '#0d0d0f'
      ctx.fillRect(i * slotW + 2, SLOT_TOP, slotW - 4, FLOOR_Y - SLOT_TOP)
      ctx.strokeStyle = isHit ? '#2997ff' : 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1
      ctx.strokeRect(i * slotW + 2, SLOT_TOP, slotW - 4, FLOOR_Y - SLOT_TOP)

      const label = this.slotLabels[i]
      if (label) {
        ctx.fillStyle = isHit ? '#ffffff' : '#6e6e73'
        ctx.font = `${isHit ? '600' : '400'} 12px -apple-system, Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, i * slotW + slotW / 2, (SLOT_TOP + FLOOR_Y) / 2)
      }
    }

    if (this.ball) {
      const { x, y } = this.ball.position
      const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, BALL_R)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(1, '#8e8e93')
      ctx.beginPath()
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    }
  }
}
