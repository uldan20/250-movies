import { useCallback, useMemo, useRef, useState } from 'react'
import type { Movie } from '../../data/types'
import { sample } from '../../lib/rng'
import { buzz, sfx } from '../../lib/sound'
import PosterImage from '../PosterImage'

type Props = {
  pool: Movie[]
  onPrize: (movie: Movie) => void
  onOpenFilters: () => void
}

type Phase = 'idle' | 'turning' | 'dropping' | 'ready' | 'opening'

const PHASE_TEXT: Record<Phase, string> = {
  idle: 'Putar kenop sampai penuh',
  turning: 'Memutar…',
  dropping: 'Kapsul keluar…',
  ready: 'Ketuk kapsul untuk memecahkannya',
  opening: 'Membuka…',
}

/** Sudut terpendek antara dua sudut, dalam derajat. */
function shortestDelta(from: number, to: number): number {
  let d = to - from
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

export default function Gashapon({
  pool,
  onPrize,
  onOpenFilters,
}: Props) {
  const knobRef = useRef<HTMLButtonElement>(null)
  const lastAngle = useRef<number | null>(null)
  const lastTick = useRef(0)
  const prizeRef = useRef<Movie | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [turn, setTurn] = useState(0) // 0..360
  const [capsule, setCapsule] = useState<Movie | null>(null)

  const onPrizeRef = useRef(onPrize)
  onPrizeRef.current = onPrize

  const canTurn = phase === 'idle' && pool.length > 0

  // Kapsul hias di dalam kubah; posisinya dibekukan supaya tidak melompat
  // setiap render.
  const domeCapsules = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = (i * 137.5 * Math.PI) / 180
        const r = 8 + Math.sqrt(i / 26) * 34
        return {
          left: 50 + Math.cos(a) * r,
          top: 52 + Math.sin(a) * r * 0.78,
          size: 15 + ((i * 7) % 9),
          tinted: i % 3 === 0,
        }
      }),
    [],
  )

  const dispense = useCallback(() => {
    if (pool.length === 0) return
    const prize = sample(pool, 1)[0]
    prizeRef.current = prize
    setCapsule(prize)
    setPhase('dropping')
    sfx.drop()
    buzz(30)
    window.setTimeout(() => setPhase('ready'), 700)
  }, [pool])

  const beginTurn = useCallback(() => {
    if (!canTurn) return
    sfx.chime()
    setPhase('turning')
  }, [canTurn])

  /** Putaran otomatis satu lingkaran penuh — jalur untuk keyboard dan klik. */
  const autoTurn = useCallback(() => {
    if (!canTurn) return
    beginTurn()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const duration = reduced ? 220 : 900
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 2)
      const deg = eased * 360
      setTurn(deg)
      if (!reduced && deg - lastTick.current >= 30) {
        lastTick.current = deg
        sfx.tick()
      }
      if (t < 1) requestAnimationFrame(step)
      else {
        lastTick.current = 0
        setTurn(360)
        dispense()
      }
    }
    requestAnimationFrame(step)
  }, [beginTurn, canTurn, dispense])

  function onPointerDown(e: React.PointerEvent) {
    if (!canTurn) return
    const rect = knobRef.current?.getBoundingClientRect()
    if (!rect) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    lastAngle.current = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
    beginTurn()
  }

  function onPointerMove(e: React.PointerEvent) {
    if (phase !== 'turning' || lastAngle.current == null) return
    const rect = knobRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
    const delta = shortestDelta(lastAngle.current, angle)
    lastAngle.current = angle

    setTurn((prev) => {
      // Memutar balik mengurangi progres, seperti kenop sungguhan.
      const next = Math.max(0, Math.min(360, prev + delta))
      if (next - lastTick.current >= 30) {
        lastTick.current = next
        sfx.tick()
      }
      if (next >= 360 && prev < 360) {
        lastAngle.current = null
        lastTick.current = 0
        dispense()
      }
      return next
    })
  }

  function endPointer() {
    lastAngle.current = null
    // Belum satu putaran penuh: kenop kembali ke awal, tapi putarannya sudah
    // dimulai — jadi lanjutkan otomatis alih-alih menghanguskannya.
    if (phase === 'turning' && turn < 360) {
      // Termasuk saat kenop cuma ditekan tanpa diputar: tanpa ini mesin
      // tersangkut di fase memutar tanpa pernah mengeluarkan kapsul.
      const from = turn
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 600)
        const deg = from + (360 - from) * (1 - Math.pow(1 - t, 2))
        setTurn(deg)
        if (t < 1) requestAnimationFrame(step)
        else {
          lastTick.current = 0
          setTurn(360)
          dispense()
        }
      }
      requestAnimationFrame(step)
    }
  }

  function crack() {
    if (phase !== 'ready' || !prizeRef.current) return
    setPhase('opening')
    sfx.crack()
    buzz([20, 40, 60])
    const prize = prizeRef.current
    window.setTimeout(() => {
      onPrizeRef.current(prize)
      setPhase('idle')
      setTurn(0)
      setCapsule(null)
      prizeRef.current = null
    }, 420)
  }

  const blocked = pool.length === 0

  return (
    <div className="mx-auto w-full max-w-md px-5">
      <div className="relative overflow-hidden rounded-[8px] border border-hairline bg-black">
        {/* kubah kapsul */}
        <div className="relative h-56 overflow-hidden border-b border-hairline">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 80% at 50% 40%, rgba(41,151,255,0.16), transparent 70%)',
            }}
          />
          {domeCapsules.map((c, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="absolute rounded-full"
              style={{
                left: `${c.left}%`,
                top: `${c.top}%`,
                width: c.size,
                height: c.size,
                transform: 'translate(-50%, -50%)',
                background: c.tinted
                  ? 'linear-gradient(160deg, #2997ff, #0a3f73)'
                  : 'linear-gradient(160deg, #3a3a3d, #202022)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
              }}
            />
          ))}
        </div>

        {/* kenop */}
        <div className="flex flex-col items-center gap-3 py-6">
          <button
            ref={knobRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                autoTurn()
              }
            }}
            disabled={!canTurn}
            aria-label="Putar kenop untuk mengeluarkan kapsul"
            className="relative flex h-24 w-24 touch-none items-center justify-center rounded-full border border-hairline bg-carbon transition-opacity disabled:opacity-40"
            style={{ transform: `rotate(${turn}deg)` }}
          >
            <span aria-hidden="true" className="absolute h-1.5 w-9 rounded-full bg-frost" />
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-signal-blue"
            />
          </button>

          {/* cincin progres putaran */}
          <div className="h-1 w-24 overflow-hidden rounded-full bg-slate">
            <div
              className="h-full bg-signal-blue transition-[width] duration-100"
              style={{ width: `${(turn / 360) * 100}%` }}
            />
          </div>
        </div>

        {/* laci kapsul */}
        <div className="relative flex h-32 items-center justify-center overflow-hidden border-t border-hairline bg-[#0b0b0d]">
          {capsule ? (
            <button
              onClick={crack}
              disabled={phase !== 'ready'}
              aria-label={`Pecahkan kapsul${phase === 'ready' ? '' : ' (belum siap)'}`}
              className="relative h-20 w-20 transition-transform duration-300"
              style={{
                transform:
                  phase === 'dropping'
                    ? 'translateY(-60px) scale(0.85)'
                    : phase === 'opening'
                      ? 'scale(1.25)'
                      : 'none',
                opacity: phase === 'opening' ? 0 : 1,
              }}
            >
              {/* kapsul: separuh bening, separuh biru */}
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(180deg, #d7dde3 0 50%, #2997ff 50% 100%)' }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-black/40"
              />
              <span
                aria-hidden="true"
                className="absolute left-4 top-3 h-4 w-6 rounded-full bg-white/55 blur-[1px]"
              />
              <span className="sr-only">Kapsul berisi film</span>
            </button>
          ) : (
            <p className="t-caption text-mist">Laci kosong</p>
          )}

          {/* Poster mengintip saat kapsul pecah. */}
          {phase === 'opening' && capsule && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <PosterImage movie={capsule} className="h-24 w-16" />
            </div>
          )}
        </div>

        {blocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
            <p className="t-body font-light text-ash">Tidak ada film yang lolos filter.</p>
            <button onClick={onOpenFilters} className="pill pill--filled">
              Ubah filter
            </button>
          </div>
        )}
      </div>

      <p className="t-body-sm mt-4 text-center font-light text-ash" aria-live="polite" role="status">
        {PHASE_TEXT[phase]}
      </p>

      <div className="mt-5 flex justify-center gap-3">
        <button onClick={autoTurn} disabled={!canTurn} className="pill pill--filled min-w-[150px]">
          Putar
        </button>
        <button onClick={crack} disabled={phase !== 'ready'} className="pill pill--quiet">
          Buka kapsul
        </button>
      </div>

      <p className="t-caption mt-5 text-center font-light text-mist">
        Kenopnya bisa diputar dengan jari, atau tekan Putar
      </p>
    </div>
  )
}
