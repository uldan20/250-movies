import { useCallback, useEffect, useRef, useState } from 'react'
import type { Movie } from '../../data/types'
import { pick, sample } from '../../lib/rng'
import { buzz, sfx } from '../../lib/sound'
import { PlinkoBoard, SLOTS } from './board'

type Props = {
  pool: Movie[]
  coins: number
  onSpend: () => void
  onPrize: (movie: Movie) => void
  onInsertCoin: () => void
  onOpenFilters: () => void
}

type Phase = 'idle' | 'falling'

const PHASE_TEXT: Record<Phase, string> = {
  idle: 'Geser titik jatuh, lalu jatuhkan bola',
  falling: 'Bola jatuh…',
}

/**
 * Isi slot diundi ulang setiap kali bola dijatuhkan.
 *
 * Itu yang menjaga keadilannya: physics memang berat ke slot tengah, tapi
 * karena penempatan filmnya diacak ulang tiap lemparan, peluang tiap film
 * tetap 1/pool — bukan bergantung slot mana yang sedang ia tempati.
 */
function drawSlots(pool: Movie[]): Movie[] {
  if (pool.length === 0) return []
  return pool.length >= SLOTS
    ? sample(pool, SLOTS)
    : Array.from({ length: SLOTS }, () => pick(pool))
}

export default function Plinko({
  pool,
  coins,
  onSpend,
  onPrize,
  onInsertCoin,
  onOpenFilters,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<PlinkoBoard | null>(null)
  const slotsRef = useRef<Movie[]>([])
  const onPrizeRef = useRef(onPrize)
  onPrizeRef.current = onPrize

  const [phase, setPhase] = useState<Phase>('idle')
  const [slots, setSlots] = useState<Movie[]>([])
  const [landed, setLanded] = useState<number | null>(null)
  const [dropX, setDropXState] = useState(0.5)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const board = new PlinkoBoard({
      canvas,
      onTick: () => sfx.tick(),
      onLanded: (slot) => {
        const movie = slotsRef.current[slot]
        setLanded(slot)
        setPhase('idle')
        sfx.drop()
        buzz([20, 30, 60])
        if (movie) onPrizeRef.current(movie)
      },
    })
    boardRef.current = board
    return () => {
      board.destroy()
      boardRef.current = null
    }
  }, [])

  // Tampilan awal sebelum lemparan pertama.
  useEffect(() => {
    const next = drawSlots(pool)
    slotsRef.current = next
    setSlots(next)
    boardRef.current?.setSlotLabels(next.map((m) => `#${m.rank}`))
  }, [pool])

  const canDrop = phase === 'idle' && coins > 0 && pool.length > 0

  const drop = useCallback(() => {
    const board = boardRef.current
    if (!board || !canDrop || board.isBusy) return
    const next = drawSlots(pool)
    slotsRef.current = next
    setSlots(next)
    setLanded(null)
    board.setSlotLabels(next.map((m) => `#${m.rank}`))
    onSpend()
    sfx.coin()
    setPhase('falling')
    board.drop()
  }, [canDrop, onSpend, pool])

  const setDrop = useCallback((fraction: number) => {
    boardRef.current?.setDropX(fraction)
    setDropXState(boardRef.current?.dropX ?? fraction)
  }, [])

  function pointerToFraction(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    return (e.clientX - rect.left) / rect.width
  }

  const blocked = pool.length === 0 || coins === 0

  return (
    <div className="mx-auto w-full max-w-md px-5">
      <div
        className="relative overflow-hidden rounded-[8px] border border-hairline bg-black"
        data-slots={slots.map((m) => m.id).join(',')}
        data-landed={landed == null ? '' : String(landed)}
      >
        <canvas
          ref={canvasRef}
          className="block w-full"
          tabIndex={0}
          role="img"
          aria-label="Papan Plinko dengan sembilan slot film"
          onPointerDown={(e) => {
            if (phase !== 'idle') return
            const f = pointerToFraction(e)
            if (f != null) setDrop(f)
          }}
          onPointerMove={(e) => {
            if (phase !== 'idle' || e.buttons === 0) return
            const f = pointerToFraction(e)
            if (f != null) setDrop(f)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setDrop(dropX - 0.06)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              setDrop(dropX + 0.06)
            } else if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              drop()
            }
          }}
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

      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          onClick={() => setDrop(dropX - 0.06)}
          disabled={!canDrop}
          aria-label="Geser titik jatuh ke kiri"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline text-[19px] text-frost transition-colors hover:bg-slate disabled:opacity-40"
        >
          ‹
        </button>
        <button onClick={drop} disabled={!canDrop} className="pill pill--filled min-w-[150px]">
          Jatuhkan
        </button>
        <button
          onClick={() => setDrop(dropX + 0.06)}
          disabled={!canDrop}
          aria-label="Geser titik jatuh ke kanan"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline text-[19px] text-frost transition-colors hover:bg-slate disabled:opacity-40"
        >
          ›
        </button>
      </div>

      <p
        className="t-caption mt-5 text-center font-light text-mist"
        aria-label={`${coins} koin tersisa`}
      >
        {coins} koin · satu lemparan memakai satu koin, dan selalu memberi film
      </p>
      <p className="t-caption mt-1 text-center font-light text-mist">
        Isi sembilan slot diundi ulang tiap lemparan, jadi peluang tiap film tetap sama
      </p>
    </div>
  )
}
