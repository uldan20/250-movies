import type { Movie } from '../data/types'
import type { Filters } from '../lib/filters'
import { buildShelves } from '../lib/shelves'
import HeroCarousel, { type MachineId } from './HeroCarousel'
import { IconTile, PosterTile, Screen, SectionHeader, Shelf } from './ui'

type Props = {
  history: string[]
  watchlist: string[]
  coins: number
  onPlay: (id: MachineId) => void
  onSelectMovie: (m: Movie) => void
  onApplyShelf: (filter: Filters) => void
  onOpenSettings: () => void
}

export default function HomeScreen({
  history,
  watchlist,
  coins,
  onPlay,
  onSelectMovie,
  onApplyShelf,
  onOpenSettings,
}: Props) {
  const shelves = buildShelves(history, watchlist)

  return (
    <Screen>
      <div className="relative">
        {/* Judul mengambang di atas artwork, seperti layar Home Apple Arcade. */}
        <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-4">
          <h1 className="t-heading font-bold text-frost drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            Beranda
          </h1>
          <div className="flex items-center gap-2">
            <span
              className="t-body-sm flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 font-medium text-frost backdrop-blur"
              aria-label={`${coins} koin tersisa`}
            >
              <span aria-hidden="true" className="h-3 w-3 rounded-full border border-frost/70" />
              {coins}
            </span>
            <button
              onClick={onOpenSettings}
              aria-label="Pengaturan"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-frost backdrop-blur"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3.2" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.17a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.93-1.16l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10.3 4.6V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0 1.2 2.87H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.01z" />
              </svg>
            </button>
          </div>
        </header>

        <HeroCarousel onPlay={onPlay} />
      </div>

      <div className="flex flex-col gap-8">
        {shelves.map((shelf) => (
          <section key={shelf.id}>
            <SectionHeader
              title={shelf.title}
              onMore={shelf.filter ? () => onApplyShelf(shelf.filter!) : undefined}
              moreLabel={`Isi mesin dengan ${shelf.title}`}
            />
            <Shelf>
              {shelf.id === 'continue'
                ? shelf.movies.map((m) => (
                    <IconTile key={m.id} movie={m} onSelect={onSelectMovie} />
                  ))
                : shelf.movies.map((m) => (
                    <PosterTile key={m.id} movie={m} onSelect={onSelectMovie} />
                  ))}
            </Shelf>
          </section>
        ))}
      </div>

      <p className="t-caption mt-10 px-6 text-center font-light text-mist">
        Daftar film adalah snapshot statis IMDb Top 250 — peringkat dan rating bisa berbeda dari
        IMDb hari ini. Poster diambil dari Wikipedia atau TMDB langsung di browsermu.
      </p>
    </Screen>
  )
}
