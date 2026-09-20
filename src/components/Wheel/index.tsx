import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Movie } from '../../data/types'
import { randRange, sample, shuffle } from '../../lib/rng'
import { buzz, sfx } from '../../lib/sound'

type Props = {
  pool: Movie[]
  coins: number
  onSpend: () => void
  onPrize: (movie: Movie) => void
  onInsertCoin: () => void
  onOpenFilters: () => void
}

type Phase = 'idle' | 'spinning'

/**
 * Lebih dari ini segmennya terlalu tipis untuk terbaca, jadi roda hanya
 * menampilkan sebagian pool. Yang penting: pemenangnya tetap diundi dari
 * SELURUH pool, lalu roda disusun di sekelilingnya — kalau tidak, film yang
 * kebetulan tidak muncul di roda tidak akan pernah bisa keluar.
 */
const MAX_SEGMENTS = 20
const SIZE = 340

const PHASE_TEXT: Record<Phase, string> = {
  idle: 'Lempar roda atau tekan putar',
  spinning: 'Memutar…',
}

/**
 * Segmen yang berada tepat di bawah jarum untuk sebuah sudut putaran.
 *
 * Segmen i menempati [i*SEG, (i+1)*SEG) diukur searah jarum jam dari posisi
 * jam 12, dan memutar roda sebesar `rotation` menggeser acuan itu berlawanan
 * arah — karena itu tandanya dibalik.
 */
export function segmentAtPointer(rotation: number, count: number): number {
  const seg = 360 / count
  const at = (((-rotation % 360) + 360) % 360) / seg
  return Math.floor(at) % count
}

export default function Wheel({
  pool,
  coins,
  onSpend,
  onPrize,
  onInsertCoin,
  onOpenFilters,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const dragRef = useRef<{ lastAngle: number; lastTime: number; velocity: number } | null>(null)
  const tickRef = useRef(0)
  const onPrizeRef = useRef(onPrize)
  onPrizeRef.current = onPrize

  const [phase, setPhase] = useState<Phase>('idle')
  const [rotation, setRotation] = useState(0)
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)

  const count = Math.min(MAX_SEGMENTS, Math.max(1, pool.length))
  const [segments, setSegments] = useState<Movie[]>([])

  // Tampilan awal sebelum putaran pertama.
  useEffect(() => {
    if (pool.length === 0) {
      setSegments([])
      return
    }
    setSegments(shuffle(pool).slice(0, count))
    setWinnerIndex(null)
    setRotation(0)
  }, [pool, count])

  const canSpin = phase === 'idle' && coins > 0 && pool.length > 0

  // ---------- gambar ----------

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || segments.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== SIZE * dpr) {
      canvas.width = SIZE * dpr
      canvas.height = SIZE * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, SIZE, SIZE)

    const cx = SIZE / 2
    const cy = SIZE / 2
    const r = SIZE / 2 - 10
    const seg = (Math.PI * 2) / segments.length

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((rotation * Math.PI) / 180)

    segments.forEach((movie, i) => {
      const a0 = -Math.PI / 2 + i * seg
      const a1 = a0 + seg
      const isWinner = winnerIndex === i && phase === 'idle'

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, r, a0, a1)
      ctx.closePath()
      ctx.fillStyle = isWinner ? 'rgba(41,151,255,0.28)' : i % 2 === 0 ? '#1d1d1f' : '#141416'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.09)'
      ctx.lineWidth = 1
      ctx.stroke()

      // peringkat film, dibaca dari arah luar
      ctx.save()
      ctx.rotate(a0 + seg / 2)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = isWinner ? '#ffffff' : '#8e8e93'
      ctx.font = `${isWinner ? '600' : '400'} 13px -apple-system, Inter, system-ui, sans-serif`
      ctx.fillText(`#${movie.rank}`, r - 14, 0)
      ctx.restore()
    })

    // cincin luar
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

    // poros
    ctx.beginPath()
    ctx.arc(cx, cy, 26, 0, Math.PI * 2)
    ctx.fillStyle = '#000000'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [phase, rotation, segments, winnerIndex])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // ---------- putaran ----------

  const spinTo = useCallback(
    (strength: number) => {
      if (pool.length === 0) return

      // Undi dari seluruh pool lebih dulu, baru susun rodanya. Dengan begini
      // peluang tiap film persis 1/pool, bukan 1/20 dari sebagian kecil yang
      // kebetulan sedang terpampang.
      const prize = sample(pool, 1)[0]
      const others = shuffle(pool.filter((m) => m.id !== prize.id)).slice(0, count - 1)
      const nextSegments = shuffle([prize, ...others])
      const w = nextSegments.findIndex((m) => m.id === prize.id)

      setSegments(nextSegments)
      setWinnerIndex(null)
      setPhase('spinning')
      onSpend()
      sfx.coin()

      const seg = 360 / nextSegments.length
      // Berhenti di tengah segmen pemenang, dengan kemelesetan yang tetap jauh
      // dari garis pembatas.
      const jitter = randRange(-seg * 0.34, seg * 0.34)
      const turns = Math.round(3 + strength * 5)
      const from = rotation
      const landing = -(w * seg + seg / 2 + jitter)
      // Maju terus searah jarum jam dari posisi sekarang.
      let target = landing
      while (target <= from + turns * 360) target += 360

      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      const duration = reduced ? 600 : 3600 + strength * 1800
      const start = performance.now()
      tickRef.current = from

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 4)
        const next = from + (target - from) * eased
        setRotation(next)
        if (!reduced && next - tickRef.current >= seg) {
          tickRef.current = next
          sfx.tick()
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step)
        } else {
          setRotation(target)
          setWinnerIndex(w)
          setPhase('idle')
          sfx.drop()
          buzz([20, 30, 60])
          onPrizeRef.current(prize)
        }
      }
      rafRef.current = requestAnimationFrame(step)
    },
    [count, onSpend, pool, rotation],
  )

  // ---------- lemparan jari ----------

  function angleFrom(e: React.PointerEvent): number | null {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!canSpin) return
    const a = angleFrom(e)
    if (a == null) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { lastAngle: a, lastTime: performance.now(), velocity: 0 }
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag || phase === 'spinning') return
    const a = angleFrom(e)
    if (a == null) return
    let delta = a - drag.lastAngle
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    const now = performance.now()
    const dt = Math.max(1, now - drag.lastTime)
    drag.velocity = delta / dt
    drag.lastAngle = a
    drag.lastTime = now
    setRotation((r) => r + delta)
  }

  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || phase === 'spinning' || !canSpin) return
    // Kecepatan lemparan menentukan berapa putaran dan berapa lama, tapi titik
    // berhentinya tetap dihitung dari pemenang yang sudah ditentukan.
    const strength = Math.min(1, Math.abs(drag.velocity) / 1.2)
    spinTo(strength)
  }

  const segmentIds = useMemo(() => segments.map((m) => m.id).join(','), [segments])
  const blocked = pool.length === 0 || coins === 0

  return (
    <div className="mx-auto w-full max-w-md px-5">
      <div
        className="relative flex flex-col items-center overflow-hidden rounded-[8px] border border-hairline bg-black py-6"
        data-rotation={rotation.toFixed(4)}
        data-segments={segmentIds}
      >
        {/* jarum di posisi jam 12 */}
        <div
          aria-hidden="true"
          className="h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-signal-blue"
        />
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ width: SIZE, height: SIZE, maxWidth: '100%', touchAction: 'none' }}
          className="mt-1 cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`Roda berisi ${segments.length} film`}
        />

        {blocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
            {pool.length === 0 ? (
              <>
                <p className="t-body font-light text-ash">Tidak ada film yang lolos filter.</p>
                <button onClick={onOpenFilters} className="pill pill--filled">
                  Ubah filter
                </button>
              </>
            ) : (
              <>
                <p className="t-subheading font-semibold text-frost">Koin habis</p>
                <button
                  onClick={() => {
                    sfx.coin()
                    onInsertCoin()
                  }}
                  className="pill pill--filled"
                >
                  Masukkan koin
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="t-body-sm mt-4 text-center font-light text-ash" aria-live="polite" role="status">
        {PHASE_TEXT[phase]}
      </p>

      <div className="mt-5 flex justify-center">
        <button
          onClick={() => spinTo(0.5)}
          disabled={!canSpin}
          className="pill pill--filled min-w-[170px]"
        >
          Putar roda
        </button>
      </div>

      <p
        className="t-caption mt-5 text-center font-light text-mist"
        aria-label={`${coins} koin tersisa`}
      >
        {coins} koin · satu putaran memakai satu koin, dan selalu memberi film
      </p>
      <p className="t-caption mt-1 text-center font-light text-mist">
        Rodanya bisa dilempar dengan jari — makin kencang, makin lama berputar
      </p>
      <p className="t-caption mt-1 text-center font-light text-mist">
        Roda menampilkan {count} film sekaligus, tapi pemenangnya diundi dari seluruh {pool.length}{' '}
        film yang lolos filter
      </p>
    </div>
  )
}
