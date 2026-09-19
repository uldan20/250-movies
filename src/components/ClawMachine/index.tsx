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
  idle: 'GESER LALU TURUNKAN',
  dropping: 'DEREK TURUN...',
  closing: 'MENJEPIT!',
  lifting: 'MENGANGKAT...',
  traveling: 'MENUJU TABUNG...',
  releasing: 'MELEPAS...',
  dispensing: 'BOLA MELUNCUR...',
  slipped: 'LEPAS! JATUH LAGI',
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
    'data-pressed': pressed === side,
  })

  // Joystick miring mengikuti arah yang sedang ditahan.
  const stickTilt = pressed === 'left' ? -18 : pressed === 'right' ? 18 : 0

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
      <div className="relative w-full">
        {/* Lantai kayu + karpet, melebar ke seluruh layar di belakang kabinet. */}
        <div
          aria-hidden="true"
          className="floor-band pointer-events-none absolute bottom-[-46px] left-1/2 h-44 w-screen -translate-x-1/2"
        />

      <div className="cabinet relative w-full px-3 pt-3 pb-4">
        {/* ---------- marquee ---------- */}
        <div className="relative flex items-center gap-2 rounded-2xl bg-navy px-3 py-3 shadow-[inset_0_3px_0_rgba(255,255,255,0.14),0_4px_0_var(--color-navy-dark)]">
          <span className="h-5 w-8 shrink-0 rounded-full bg-navy-dark shadow-[inset_0_2px_0_rgba(0,0,0,0.4)]" />
          <p className="marquee-text flex-1 text-center font-display text-lg leading-none sm:text-xl">
            MOVIE CATCHER
          </p>
          <span className="h-5 w-8 shrink-0 rounded-full bg-navy-dark shadow-[inset_0_2px_0_rgba(0,0,0,0.4)]" />
        </div>

        {/* ---------- kabin kaca ---------- */}
        <div className="wood-frame mt-3 p-2.5">
          <div className="relative aspect-[62/64] w-full overflow-hidden rounded-lg bg-[#2f5952]">
            <canvas
              ref={canvasRef}
              className="h-full w-full"
              role="img"
              aria-label="Kabin mesin capit berisi bola film"
            />
            {pool.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#23423d]/90 p-6 text-center">
                <p className="text-sm font-bold text-cream">
                  Kabin kosong — tidak ada film yang lolos filter. Longgarkan filternya dulu.
                </p>
              </div>
            )}
            {coins === 0 && pool.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#23423d]/90 p-6 text-center">
                <p className="font-display text-lg text-cream">KOIN HABIS</p>
                <button
                  onClick={() => {
                    sfx.coin()
                    onInsertCoin()
                  }}
                  className="toy-btn px-6 py-3 text-base"
                >
                  MASUKKAN KOIN
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---------- layar status + ventilasi ---------- */}
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-7 flex-1 items-center gap-1 px-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-full w-1.5 rounded-full bg-cab-dark/70" />
            ))}
          </span>
          <div className="flex h-9 flex-[3] items-center justify-center rounded-lg bg-navy px-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]">
            <p
              className="truncate font-display text-[11px] tracking-wider text-[#7fe3d9] sm:text-xs"
              aria-live="polite"
              role="status"
            >
              {PHASE_TEXT[phase]}
            </p>
          </div>
          <span className="flex h-7 flex-1 items-center justify-end gap-1 px-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-full w-1.5 rounded-full bg-cab-dark/70" />
            ))}
          </span>
        </div>

        {/* ---------- dek kontrol ---------- */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3 shadow-[inset_0_-4px_0_rgba(0,0,0,0.1),0_4px_0_#cbbfa6]">
          {/* joystick */}
          <div className="relative h-14 w-12 shrink-0" aria-hidden="true">
            <span className="absolute bottom-0 left-1/2 h-4 w-11 -translate-x-1/2 rounded-full bg-[#3b6fab] shadow-[inset_0_2px_0_rgba(255,255,255,0.35)]" />
            <span
              className="absolute bottom-2 left-1/2 h-9 w-2.5 origin-bottom -translate-x-1/2 rounded-full bg-[#b9c6cc] transition-transform duration-150"
              style={{ transform: `translateX(-50%) rotate(${stickTilt}deg)` }}
            />
            <span
              className="absolute bottom-8 left-1/2 h-6 w-6 origin-bottom -translate-x-1/2 rounded-full bg-red shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.18),inset_2px_2px_0_rgba(255,255,255,0.4)] transition-transform duration-150"
              style={{
                transform: `translateX(-50%) translateX(${stickTilt * 0.5}px) rotate(${stickTilt}deg)`,
              }}
            />
          </div>

          {/* tombol arah */}
          <div className="flex items-center gap-3">
            <button
              {...holdProps(-1, 'left')}
              disabled={!canPlay}
              aria-label="Geser derek ke kiri"
              className="arcade-knob h-14 w-14 bg-red text-2xl text-cream shadow-[0_5px_0_#a82f27,inset_0_-3px_0_rgba(0,0,0,0.18)]"
            >
              <span className="relative z-10">◀</span>
            </button>
            <button
              {...holdProps(1, 'right')}
              disabled={!canPlay}
              aria-label="Geser derek ke kanan"
              className="arcade-knob h-14 w-14 bg-orange text-2xl text-cream shadow-[0_5px_0_#b9641a,inset_0_-3px_0_rgba(0,0,0,0.18)]"
            >
              <span className="relative z-10">▶</span>
            </button>
          </div>

          {/* panel koin */}
          <div className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-navy shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]">
            <span className="font-display text-[9px] leading-none text-[#7fe3d9]">KOIN</span>
            <span className="font-display text-lg leading-tight text-cream">{coins}</span>
          </div>
        </div>

        {/* ---------- lampu + pintu hadiah + slot koin ---------- */}
        <div className="mt-3 flex items-center gap-2 px-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="led h-2.5 w-2.5 rounded-full bg-[#3b6fab] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
          <span className="ml-auto h-1.5 w-10 rounded-full bg-cab-dark/60" />
        </div>

        <div className="mt-3 flex items-end gap-3">
          <div className="h-16 flex-1 rounded-lg border-4 border-cream bg-[#2f5952] shadow-[inset_0_3px_8px_rgba(0,0,0,0.45)]" />
          <div className="flex h-16 w-24 items-center justify-center gap-2 rounded-lg bg-cream px-2 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-4 border-red bg-cream">
              <span className="h-4 w-0.5 rotate-45 bg-red" />
            </span>
            <span className="flex h-9 w-5 flex-col overflow-hidden rounded-sm border-2 border-ink/70">
              <span className="h-1/2 bg-cream" />
              <span className="h-1/2 bg-ink/80" />
            </span>
          </div>
        </div>
      </div>

        {/* alas kabinet */}
        <div className="relative mx-auto h-5 w-[94%] rounded-b-2xl bg-cab-base shadow-[0_10px_18px_-8px_rgba(35,66,61,0.65)]" />
      </div>

      {/* ---------- tombol utama ---------- */}
      <button
        onClick={drop}
        disabled={!canPlay}
        className="toy-btn w-full px-6 py-4 text-xl"
        aria-label="Turunkan derek dan capit bola"
      >
        CAPIT BOLA
      </button>

      <p className="text-center text-xs font-semibold text-ink/50">
        Keyboard: ← → menggeser, Spasi menurunkan derek
      </p>
    </div>
  )
}
