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
}

const PHASE_TEXT: Record<GamePhase, string> = {
  idle: 'Geser derek, lalu tekan TURUN',
  dropping: 'Derek turun…',
  closing: 'Menjepit!',
  lifting: 'Mengangkat…',
  traveling: 'Menuju lubang hadiah…',
  releasing: 'Melepas…',
  dispensing: 'Kapsul meluncur ke lubang…',
  slipped: 'Lepas! Kapsulnya jatuh',
}

export default function ClawMachine({
  pool,
  coins,
  onSpend,
  onPrize,
  onMiss,
  onInsertCoin,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ClawGame | null>(null)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [pressed, setPressed] = useState<'left' | 'right' | null>(null)

  // Callback terbaru disimpan di ref supaya game tidak perlu dibangun ulang
  // setiap kali parent render.
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

  // Isi ulang kabin hanya kalau isi pool benar-benar berubah.
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

  const move = useCallback(
    (dir: number, from: 'left' | 'right' | null) => {
      gameRef.current?.setMove(dir)
      setPressed(dir === 0 ? null : from)
    },
    [],
  )

  // Kontrol keyboard: panah untuk geser, spasi untuk menurunkan derek.
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

  // Jari yang terangkat di luar tombol tidak boleh membuat derek jalan terus.
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
    'data-pressed': pressed === side,
  })

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <div className="cabinet-frame relative overflow-hidden rounded-2xl p-3">
        {/* marquee kabinet */}
        <div className="marquee-glow mb-2 rounded-lg bg-gradient-to-r from-neon/30 via-violet/25 to-cyan/30 px-3 py-2 text-center">
          <p className="font-display text-[10px] text-white neon-text">MOVIE CATCHER</p>
        </div>

        <div className="relative aspect-[62/72] w-full overflow-hidden rounded-lg bg-black">
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            role="img"
            aria-label="Kabin mesin capit berisi kapsul film"
          />
          {pool.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
              <p className="text-sm text-amber-200">
                Kabin kosong — tidak ada film yang lolos filter. Longgarkan filter dulu.
              </p>
            </div>
          )}
          {coins === 0 && pool.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
              <p className="font-display text-[11px] text-neon-soft neon-text">KOIN HABIS</p>
              <button
                onClick={() => {
                  sfx.coin()
                  onInsertCoin()
                }}
                className="arcade-btn bg-neon/30 px-5 py-3 font-display text-[10px] text-white"
              >
                MASUKKAN KOIN
              </button>
            </div>
          )}
        </div>

        <p
          className="mt-2 min-h-[1.5rem] text-center text-sm text-white/65"
          aria-live="polite"
          role="status"
        >
          {PHASE_TEXT[phase]}
        </p>
      </div>

      {/* panel kontrol */}
      <div className="panel grid grid-cols-[1fr_1.2fr_1fr] gap-3 rounded-2xl p-4">
        <button
          {...holdProps(-1, 'left')}
          disabled={!canPlay}
          aria-label="Geser derek ke kiri"
          className="arcade-btn bg-cyan/20 py-6 text-2xl text-cyan"
        >
          ◀
        </button>
        <button
          onClick={drop}
          disabled={!canPlay}
          aria-label="Turunkan derek"
          className="arcade-btn bg-neon/30 py-6 font-display text-[11px] text-white"
        >
          TURUN
        </button>
        <button
          {...holdProps(1, 'right')}
          disabled={!canPlay}
          aria-label="Geser derek ke kanan"
          className="arcade-btn bg-cyan/20 py-6 text-2xl text-cyan"
        >
          ▶
        </button>
      </div>

      <p className="text-center text-xs text-white/35">
        Keyboard: ← → untuk menggeser, Spasi untuk menurunkan derek
      </p>
    </div>
  )
}
