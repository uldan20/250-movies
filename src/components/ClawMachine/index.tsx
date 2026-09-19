import { useCallback, useEffect, useRef, useState } from 'react'
import type { Movie } from '../../data/types'
import { sfx } from '../../lib/sound'
import { ClawGame, type GamePhase } from './game'

type Props = {
  pool: Movie[]
  coins: number
  onSpend: () => void
  onPrize: (movie: Movie) => void
  onMiss: () => void
  onInsertCoin: () => void
  onOpenFilters: () => void
}

const PHASE_TEXT: Record<GamePhase, string> = {
  idle: 'Geser derek, lalu capit',
  dropping: 'Derek turun',
  closing: 'Menjepit',
  lifting: 'Mengangkat',
  traveling: 'Menuju lubang hadiah',
  releasing: 'Melepas',
  dispensing: 'Meluncur ke lubang',
  slipped: 'Lepas — jatuh lagi',
}

/** Tombol arah bundar bergaris rambut, tanpa isian warna. */
function ArrowButton({
  label,
  glyph,
  disabled,
  pressed,
  bind,
}: {
  label: string
  glyph: string
  disabled: boolean
  pressed: boolean
  bind: Record<string, unknown>
}) {
  return (
    <button
      {...bind}
      disabled={disabled}
      aria-label={label}
      data-pressed={pressed}
      className={`flex h-14 w-14 items-center justify-center rounded-full border text-[19px] transition-colors ${
        disabled
          ? 'border-hairline text-mist opacity-40'
          : pressed
            ? 'border-frost bg-slate text-frost'
            : 'border-hairline text-frost hover:bg-slate'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      {glyph}
    </button>
  )
}

export default function ClawMachine({
  pool,
  coins,
  onSpend,
  onPrize,
  onMiss,
  onInsertCoin,
  onOpenFilters,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ClawGame | null>(null)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [pressed, setPressed] = useState<'left' | 'right' | null>(null)

  const handlers = useRef({ onPrize, onMiss })
  handlers.current = { onPrize, onMiss }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const game = new ClawGame({
      canvas,
      pool,
      onPhase: setPhase,
      onPrize: (m) => handlers.current.onPrize(m),
      onMiss: () => handlers.current.onMiss(),
    })
    gameRef.current = game
    return () => {
      game.destroy()
      gameRef.current = null
    }
    // Sengaja hanya sekali: perubahan pool ditangani efek di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const poolSignature = pool.map((m) => m.id).join(',')
  const lastSignature = useRef(poolSignature)
  useEffect(() => {
    if (lastSignature.current === poolSignature) return
    lastSignature.current = poolSignature
    gameRef.current?.setPool(pool)
  }, [poolSignature, pool])

  const canPlay = phase === 'idle' && coins > 0 && pool.length > 0

  const drop = useCallback(() => {
    const game = gameRef.current
    if (!game || !game.canDrop() || coins <= 0) return
    onSpend()
    sfx.coin()
    game.drop()
  }, [coins, onSpend])

  const move = useCallback((dir: number, from: 'left' | 'right' | null) => {
    gameRef.current?.setMove(dir)
    setPressed(dir === 0 ? null : from)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        move(-1, 'left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        move(1, 'right')
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        drop()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') move(0, null)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [drop, move])

  useEffect(() => {
    const stop = () => move(0, null)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
    }
  }, [move])

  const holdProps = (dir: -1 | 1, side: 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      move(dir, side)
    },
    onPointerUp: () => move(0, null),
    onPointerLeave: () => move(0, null),
  })

  return (
    <div className="mx-auto w-full max-w-md px-5">
        <div className="relative aspect-[62/64] w-full overflow-hidden rounded-[8px] border border-hairline bg-black">
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            role="img"
            aria-label="Kabin mesin capit berisi ubin poster film"
          />
          {pool.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center">
              <p className="t-body font-light text-ash">
                Kabin kosong — tidak ada film yang lolos filter.
              </p>
              <button onClick={onOpenFilters} className="pill pill--filled">
                Ubah filter
              </button>
            </div>
          )}
          {coins === 0 && pool.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center">
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
            </div>
          )}
        </div>

        <p
          className="t-body-sm mt-4 text-center font-light text-ash"
          aria-live="polite"
          role="status"
        >
          {PHASE_TEXT[phase]}
        </p>

        <div className="mt-5 flex items-center justify-center gap-4">
          <ArrowButton
            label="Geser derek ke kiri"
            glyph="‹"
            disabled={!canPlay}
            pressed={pressed === 'left'}
            bind={holdProps(-1, 'left')}
          />
          <button onClick={drop} disabled={!canPlay} className="pill pill--filled min-w-[150px]">
            Capit
          </button>
          <ArrowButton
            label="Geser derek ke kanan"
            glyph="›"
            disabled={!canPlay}
            pressed={pressed === 'right'}
            bind={holdProps(1, 'right')}
          />
        </div>

        <p
          className="t-caption mt-5 text-center font-light text-mist"
          aria-label={`${coins} koin tersisa`}
        >
          {coins} koin · satu capit memakai satu koin, menang mengembalikannya
        </p>
      <p className="t-caption mt-1 text-center font-light text-mist">
        Keyboard: ← → menggeser, Spasi mencapit
      </p>
    </div>
  )
}
