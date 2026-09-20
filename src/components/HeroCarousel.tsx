import { useCallback, useEffect, useRef, useState } from 'react'
import { MOVIES } from '../data/movies'
import type { Movie } from '../data/types'
import { sfx } from '../lib/sound'
import PosterImage from './PosterImage'

import type { MachineId } from './MachineScreen'

export type Slide = {
  id: MachineId | string
  name: string
  eyebrow: string
  tagline: string
  available: boolean
  accent: string
  backdrop: Movie[]
}

/** Film untuk latar tiap slide diambil dari peringkat berbeda supaya tidak berulang. */
function backdropAt(offset: number): Movie[] {
  return Array.from({ length: 5 }, (_, i) => MOVIES[(offset + i * 7) % MOVIES.length])
}

export const SLIDES: Slide[] = [
  {
    id: 'claw',
    name: 'Movie Catcher',
    eyebrow: 'Untuk kamu',
    tagline: 'Capit satu film dari 250 terbaik. Cengkeramannya bisa lepas.',
    available: true,
    accent: '#2997ff',
    backdrop: backdropAt(0),
  },
  {
    id: 'case',
    name: 'Case Opening',
    eyebrow: 'Baru',
    tagline: 'Strip poster melaju kencang lalu berhenti tepat di satu pemenang.',
    available: true,
    accent: '#ff9f0a',
    backdrop: backdropAt(3),
  },
  {
    id: 'gacha',
    name: 'Gashapon',
    eyebrow: 'Baru',
    tagline: 'Putar kenop satu lingkaran penuh, lalu pecahkan kapsulnya.',
    available: true,
    accent: '#bf5af2',
    backdrop: backdropAt(11),
  },
  {
    id: 'wheel',
    name: 'Roda Putar',
    eyebrow: 'Baru',
    tagline: 'Lempar rodanya dengan jari, biarkan jarum yang memutuskan.',
    available: true,
    accent: '#30d158',
    backdrop: backdropAt(23),
  },
  {
    id: 'plinko',
    name: 'Plinko',
    eyebrow: 'Baru',
    tagline: 'Jatuhkan bola, biarkan pin memutuskan tontonan malam ini.',
    available: true,
    accent: '#64d2ff',
    backdrop: backdropAt(41),
  },
  {
    id: 'bracket',
    name: 'Turnamen 16',
    eyebrow: 'Segera hadir',
    tagline: 'Enam belas film, delapan duel, satu juara pilihanmu.',
    available: false,
    accent: '#ff453a',
    backdrop: backdropAt(59),
  },
]

const AUTO_MS = 7000

export default function HeroCarousel({ onPlay }: { onPlay: (id: MachineId) => void }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const dragStart = useRef<number | null>(null)
  const [dragDx, setDragDx] = useState(0)

  const go = useCallback((next: number) => {
    setIndex(((next % SLIDES.length) + SLIDES.length) % SLIDES.length)
  }, [])

  // Maju sendiri seperti Apple Arcade, tapi berhenti saat disentuh dan tidak
  // pernah berjalan kalau pengguna meminta animasi dikurangi.
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || paused) return
    const t = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTO_MS)
    return () => window.clearInterval(t)
  }, [paused])

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientX
    setPaused(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current == null) return
    setDragDx(e.clientX - dragStart.current)
  }

  function onPointerUp() {
    if (dragStart.current == null) return
    if (dragDx > 60) go(index - 1)
    else if (dragDx < -60) go(index + 1)
    dragStart.current = null
    setDragDx(0)
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Mesin unggulan"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
    >
      <div
        className="relative w-full touch-pan-y overflow-hidden"
        style={{ height: 'clamp(420px, min(125vw, 74vh), 620px)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(index - 1)
          if (e.key === 'ArrowRight') go(index + 1)
        }}
        tabIndex={0}
        role="group"
        aria-label={`Slide ${index + 1} dari ${SLIDES.length}`}
      >
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(calc(-${index * 100}% + ${dragDx}px))`,
            transitionDuration: dragStart.current != null ? '0ms' : undefined,
          }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.id}
              className="relative flex h-full w-full shrink-0 flex-col justify-end overflow-hidden"
            >
              {/* Dasar gradasi aksen: menahan hero tetap berisi meski poster gagal dimuat. */}
              <div
                className="absolute inset-0"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(165deg, ${slide.accent}55 0%, ${slide.accent}22 38%, #000 78%)`,
                }}
              />
              {/* latar: deretan poster yang diburamkan */}
              <div className="absolute inset-0 flex" aria-hidden="true">
                {slide.backdrop.map((m) => (
                  <PosterImage
                    key={m.id}
                    movie={m}
                    className="h-full w-1/5 min-w-0 shrink scale-110 object-cover opacity-55 blur-[2px]"
                    rounded="rounded-none"
                  />
                ))}
              </div>
              <div
                className="absolute inset-0"
                aria-hidden="true"
                style={{
                  background: `radial-gradient(ellipse 80% 60% at 50% 25%, ${slide.accent}3d, transparent 70%)`,
                }}
              />
              <div
                className="absolute inset-0"
                aria-hidden="true"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 32%, rgba(0,0,0,0.82) 72%, #000 100%)',
                }}
              />

              <div className="relative z-10 flex flex-col items-center px-6 pb-8 text-center">
                <p className="t-eyebrow text-frost/75">{slide.eyebrow}</p>
                <h2 className="t-heading mt-1.5 font-semibold text-frost">{slide.name}</h2>
                <p className="t-body mt-1.5 max-w-sm font-light text-frost/80">{slide.tagline}</p>
                <button
                  className="pill pill--glass mt-5 min-w-[170px]"
                  disabled={!slide.available}
                  tabIndex={i === index ? 0 : -1}
                  onClick={() => {
                    if (!slide.available) return
                    sfx.click()
                    onPlay(slide.id as MachineId)
                  }}
                >
                  {slide.available ? 'Mainkan' : 'Segera hadir'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-4">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => go(i)}
            aria-label={`Ke slide ${i + 1}: ${slide.name}`}
            aria-current={i === index ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-frost' : 'w-1.5 bg-mist/60'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
