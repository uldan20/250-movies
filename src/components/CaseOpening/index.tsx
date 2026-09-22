import { useCallback, useEffect, useRef, useState } from 'react'
import type { Movie } from '../../data/types'
import { pick, randRange, sample } from '../../lib/rng'
import { buzz, sfx } from '../../lib/sound'
import PosterImage from '../PosterImage'

type Props = {
  pool: Movie[]
  onPrize: (movie: Movie) => void
  onOpenFilters: () => void
}

type Phase = 'idle' | 'spinning' | 'done'

const TILE_W = 86
const GAP = 10
const STEP = TILE_W + GAP
/** Panjang strip dan posisi pemenang: sisakan beberapa ubin di kanan penanda. */
const STRIP_LEN = 56
const WIN_INDEX = 48
const SPIN_MS = 6200

const PHASE_TEXT: Record<Phase, string> = {
  idle: 'Tekan buka untuk memutar',
  spinning: 'Memutar…',
  done: 'Berhenti',
}

export default function CaseOpening({
  pool,
  onPrize,
  onOpenFilters,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const animRef = useRef<Animation | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [strip, setStrip] = useState<Movie[]>([])
  const [winner, setWinner] = useState<Movie | null>(null)

  const onPrizeRef = useRef(onPrize)
  onPrizeRef.current = onPrize

  // Strip awal hanya hiasan sampai putaran pertama.
  useEffect(() => {
    if (pool.length === 0) {
      setStrip([])
      return
    }
    setStrip(Array.from({ length: STRIP_LEN }, () => pick(pool)))
  }, [pool])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      animRef.current?.cancel()
    },
    [],
  )

  const canPlay = phase !== 'spinning' && pool.length > 0

  const open = useCallback(() => {
    const viewport = viewportRef.current
    const el = stripRef.current
    if (!viewport || !el || !canPlay) return

    // Pemenang ditentukan lebih dulu, lalu posisi berhenti dihitung agar ubin
    // itulah yang persis berada di bawah penanda.
    const prize = sample(pool, 1)[0]
    const next = Array.from({ length: STRIP_LEN }, () => pick(pool))
    next[WIN_INDEX] = prize
    setStrip(next)
    setWinner(prize)
    setPhase('spinning')
    sfx.chime()

    const cw = viewport.clientWidth
    const startX = cw / 2 - (2 * STEP + TILE_W / 2)
    // Sedikit meleset dari titik tengah supaya tidak terasa mekanis, tapi tetap
    // jauh di dalam batas ubin pemenang.
    const jitter = randRange(-TILE_W * 0.28, TILE_W * 0.28)
    const targetX = cw / 2 - (WIN_INDEX * STEP + TILE_W / 2) + jitter

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const duration = reduced ? 700 : SPIN_MS

    animRef.current?.cancel()
    const anim = el.animate(
      [{ transform: `translateX(${startX}px)` }, { transform: `translateX(${targetX}px)` }],
      { duration, easing: 'cubic-bezier(0.08, 0.72, 0.06, 1)', fill: 'forwards' },
    )
    animRef.current = anim

    if (!reduced) {
      let lastTile = -1
      const tick = () => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
        const passed = Math.floor((cw / 2 - m.m41) / STEP)
        if (passed !== lastTile) {
          lastTile = passed
          sfx.tick()
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    anim.onfinish = () => {
      cancelAnimationFrame(rafRef.current)
      setPhase('done')
      sfx.drop()
      buzz([20, 30, 60])
      onPrizeRef.current(prize)
    }
  }, [canPlay, pool])

  return (
    <div className="mx-auto w-full max-w-md px-5">
      <div className="relative overflow-hidden rounded-[8px] border border-hairline bg-black py-6">
        {/* penanda tengah */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-signal-blue"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1.5 z-10 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-signal-blue"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[6px] border-b-[8px] border-x-transparent border-b-signal-blue"
        />
        {/* tepi kiri-kanan meredup supaya strip terasa berlanjut */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'linear-gradient(90deg, #000 0%, transparent 13%, transparent 87%, #000 100%)',
          }}
        />

        <div ref={viewportRef} className="relative overflow-hidden">
          <div
            ref={stripRef}
            data-winner={winner?.id ?? ''}
            className="flex will-change-transform"
            style={{ gap: `${GAP}px` }}
          >
            {strip.map((m, i) => (
              <div
                key={`${m.id}-${i}`}
                data-movie={m.id}
                className="shrink-0"
                style={{ width: TILE_W }}
              >
                <PosterImage movie={m} className="aspect-[2/3] w-full" />
              </div>
            ))}
          </div>
        </div>

        {pool.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
            <p className="t-body font-light text-ash">
              Tidak ada film yang lolos filter.
            </p>
            <button onClick={onOpenFilters} className="pill pill--filled">
              Ubah filter
            </button>
          </div>
        )}
      </div>

      <p className="t-body-sm mt-4 text-center font-light text-ash" aria-live="polite" role="status">
        {PHASE_TEXT[phase]}
      </p>

      <div className="mt-5 flex justify-center">
        <button onClick={open} disabled={!canPlay} className="pill pill--filled min-w-[190px]">
          Buka case
        </button>
      </div>
<p className="t-caption mt-5 text-center font-light text-mist">
  Tiap putaran selalu berhenti di satu film
</p>
    </div>
  )
}
