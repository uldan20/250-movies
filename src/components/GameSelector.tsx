import { useCallback, useEffect, useRef, useState } from 'react'
import { MOVIES } from '../data/movies'
import type { Movie } from '../data/types'
import { sfx } from '../lib/sound'
import PosterImage from './PosterImage'

import type { MachineId } from './MachineScreen'

export type CategoryId = 'skill' | 'kejutan' | 'undian' | 'duel'

export type Game = {
  id: MachineId
  name: string
  /** Baris kedua di kartu: jenis permainan, bukan kalimat. */
  kind: string
  tagline: string
  category: CategoryId
  accent: string
  art: Movie[]
}

/**
 * Empat poster jadi mozaik 2x2 di dalam kartu 2:3, jadi tiap selnya juga 2:3 —
 * poster tidak terpotong sama sekali. Offsetnya berbeda tiap mesin supaya
 * kartu tetangga tidak memakai film yang sama.
 */
function artAt(offset: number): Movie[] {
  return Array.from({ length: 4 }, (_, i) => MOVIES[(offset + i * 7) % MOVIES.length])
}

export const GAMES: Game[] = [
  {
    id: 'claw',
    name: 'Movie Catcher',
    kind: 'Arcade Keterampilan',
    tagline: 'Capit satu film dari 250 terbaik. Cengkeramannya bisa lepas.',
    category: 'skill',
    accent: '#2997ff',
    art: artAt(0),
  },
  {
    id: 'case',
    name: 'Case Opening',
    kind: 'Arcade Kejutan',
    tagline: 'Strip poster melaju kencang lalu berhenti tepat di satu pemenang.',
    category: 'kejutan',
    accent: '#ff9f0a',
    art: artAt(3),
  },
  {
    id: 'gacha',
    name: 'Gashapon',
    kind: 'Arcade Kejutan',
    tagline: 'Putar kenop satu lingkaran penuh, lalu pecahkan kapsulnya.',
    category: 'kejutan',
    accent: '#bf5af2',
    art: artAt(11),
  },
  {
    id: 'wheel',
    name: 'Roda Putar',
    kind: 'Arcade Undian',
    tagline: 'Lempar rodanya dengan jari, biarkan jarum yang memutuskan.',
    category: 'undian',
    accent: '#30d158',
    art: artAt(23),
  },
  {
    id: 'plinko',
    name: 'Plinko',
    kind: 'Arcade Keterampilan',
    tagline: 'Jatuhkan bola, biarkan pin memutuskan tontonan malam ini.',
    category: 'skill',
    accent: '#64d2ff',
    art: artAt(41),
  },
  {
    id: 'bracket',
    name: 'Turnamen 16',
    kind: 'Arcade Duel',
    tagline: 'Enam belas film, lima belas duel, satu juara pilihanmu.',
    category: 'duel',
    accent: '#ff453a',
    art: artAt(59),
  },
]

export const CATEGORIES: { id: 'all' | CategoryId; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'skill', label: 'Keterampilan' },
  { id: 'kejutan', label: 'Kejutan' },
  { id: 'undian', label: 'Undian' },
  { id: 'duel', label: 'Duel' },
]

const SWIPE_PX = 48

type Props = {
  /** Mesin yang sedang terpilih; kartunya yang ditaruh di tengah saat beranda dibuka. */
  current: MachineId
  onPlay: (id: MachineId) => void
  /** Kartu yang sedang di tengah jadi mesin terpilih, termasuk untuk tombol putar mengambang. */
  onHighlight?: (id: MachineId) => void
}

export default function GameSelector({ current, onPlay, onHighlight }: Props) {
  const [category, setCategory] = useState<'all' | CategoryId>('all')
  const [index, setIndex] = useState(() => Math.max(0, GAMES.findIndex((g) => g.id === current)))
  const [dragDx, setDragDx] = useState(0)
  const dragStart = useRef<number | null>(null)
  /** Geseran berakhir di atas kartu, jadi klik sesudahnya harus ditelan. */
  const dragged = useRef(false)

  const games = category === 'all' ? GAMES : GAMES.filter((g) => g.category === category)
  const at = Math.min(index, games.length - 1)
  const active = games[at]

  useEffect(() => {
    onHighlight?.(active.id)
  }, [active.id, onHighlight])

  const go = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(next, games.length - 1))),
    [games.length],
  )

  function pickCategory(id: 'all' | CategoryId) {
    sfx.click()
    setCategory(id)
    setIndex(0)
  }

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientX
    dragged.current = false
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current == null) return
    const dx = e.clientX - dragStart.current
    if (Math.abs(dx) > 8) dragged.current = true
    setDragDx(dx)
  }

  function onPointerUp() {
    if (dragStart.current == null) return
    if (dragDx > SWIPE_PX) go(at - 1)
    else if (dragDx < -SWIPE_PX) go(at + 1)
    dragStart.current = null
    setDragDx(0)
  }

  return (
    <section aria-label="Pilih mesin">
      <div role="tablist" aria-label="Kategori mesin" className="chip-row pb-5 pt-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={category === c.id}
            data-category={c.id}
            onClick={() => pickCategory(c.id)}
            className="chip"
          >
            <span>{c.label}</span>
            <span className="chip-dot" aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="relative">
        {/* Cahaya latar ikut warna kartu aktif, jadi kartu terasa menyatu dengan layar. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-[background] duration-500"
          style={{
            background: `radial-gradient(ellipse 72% 46% at 50% 38%, ${active.accent}26, transparent 72%)`,
          }}
        />

        <div
          className="gs-viewport relative"
          style={
            { '--gs-card': 'clamp(196px, 64vw, 300px)', '--gs-gap': '14px' } as React.CSSProperties
          }
          role="group"
          aria-roledescription="carousel"
          aria-label={`Mesin ${at + 1} dari ${games.length}: ${active.name}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') go(at - 1)
            if (e.key === 'ArrowRight') go(at + 1)
          }}
        >
          <div
            className="gs-track"
            style={{
              transform: `translate3d(calc(${-at} * (var(--gs-card) + var(--gs-gap)) + ${dragDx}px), 0, 0)`,
              transitionDuration: dragStart.current != null ? '0ms' : undefined,
            }}
          >
            {games.map((game, i) => {
              const distance = Math.abs(i - at)
              const isActive = distance === 0
              return (
                <button
                  key={game.id}
                  data-game-card={game.id}
                  data-active={isActive}
                  tabIndex={isActive ? 0 : -1}
                  aria-label={isActive ? `Mainkan ${game.name}` : `Pilih ${game.name}`}
                  onClick={() => {
                    if (dragged.current) {
                      dragged.current = false
                      return
                    }
                    sfx.click()
                    if (isActive) onPlay(game.id)
                    else go(i)
                  }}
                  className="gs-card"
                  style={{
                    transform: `scale(${isActive ? 1 : 0.88})`,
                    opacity: isActive ? 1 : distance === 1 ? 0.5 : 0.3,
                  }}
                >
                  <div
                    data-art
                    aria-hidden="true"
                    className="absolute inset-0 grid grid-cols-2 grid-rows-2 scale-105 opacity-70 blur-[1px]"
                  >
                    {game.art.map((m) => (
                      <PosterImage
                        key={m.id}
                        movie={m}
                        className="h-full w-full min-w-0 object-cover"
                        rounded="rounded-none"
                      />
                    ))}
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(162deg, ${game.accent}7a 0%, ${game.accent}33 40%, rgba(0,0,0,0.7) 78%, #000 100%)`,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/2"
                    style={{
                      background:
                        'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.72) 62%, rgba(0,0,0,0.92) 100%)',
                    }}
                  />

                  <div className="relative z-10 flex items-end justify-between gap-3 p-4 text-left">
                    <div className="min-w-0">
                      <h3 className="t-subheading truncate font-semibold text-frost">
                        {game.name}
                      </h3>
                      <p className="t-body-sm mt-1 truncate font-light text-frost/70">
                        {game.kind}
                      </p>
                    </div>
                    <span data-play className="gs-play" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.5 5.6v12.8a.7.7 0 0 0 1.07.6l10-6.4a.7.7 0 0 0 0-1.2l-10-6.4a.7.7 0 0 0-1.07.6z" />
                      </svg>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <p className="t-body-sm relative mx-auto mt-4 min-h-[2.6em] max-w-[19rem] px-6 text-center font-light text-ash">
        {active.tagline}
      </p>

      <div className="relative flex items-center justify-center gap-2 pb-2 pt-4">
        {games.length > 1 &&
          games.map((game, i) => (
            <button
              key={game.id}
              onClick={() => {
                sfx.click()
                go(i)
              }}
              aria-label={`Ke slide ${i + 1}: ${game.name}`}
              aria-current={i === at ? 'true' : undefined}
              className={`h-1.5 rounded-full transition-all ${
                i === at ? 'w-6 bg-frost' : 'w-1.5 bg-mist/60'
              }`}
            />
          ))}
      </div>
    </section>
  )
}
