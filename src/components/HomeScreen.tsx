import type { Movie } from '../data/types'
import type { Filters } from '../lib/filters'
import { buildShelves } from '../lib/shelves'
import GameSelector from './GameSelector'
import type { MachineId } from './MachineScreen'
import { IconTile, PosterTile, Screen, SectionHeader, Shelf } from './ui'

type Props = {
  machine: MachineId
  history: string[]
  watchlist: string[]
  coins: number
  activeFilters: number
  onPlay: (id: MachineId) => void
  onHighlight: (id: MachineId) => void
  onSelectMovie: (m: Movie) => void
  onApplyShelf: (filter: Filters) => void
  onOpenSearch: () => void
  onOpenFilters: () => void
  onOpenSettings: () => void
}

export default function HomeScreen({
  machine,
  history,
  watchlist,
  coins,
  activeFilters,
  onPlay,
  onHighlight,
  onSelectMovie,
  onApplyShelf,
  onOpenSearch,
  onOpenFilters,
  onOpenSettings,
}: Props) {
  const shelves = buildShelves(history, watchlist)

  return (
    <Screen>
      {/* Judul di tengah diapit dua kontrol bundar, lalu kolom cari — kepala layar pemilih mesin. */}
      <header className="safe-top grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 pb-4">
        <button
          onClick={onOpenSettings}
          aria-label="Pengaturan"
          title="Pengaturan"
          className="chrome-btn"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h11M4 17h16" />
          </svg>
        </button>

        <h1 className="t-body text-center font-semibold text-frost">Beranda</h1>

        <span
          className="t-body-sm relative flex h-10 items-center gap-1.5 rounded-full border border-hairline bg-carbon px-3 font-semibold text-frost"
          aria-label={`${coins} koin tersisa`}
        >
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-frost/70" />
          {coins}
          {coins === 0 && <span className="chrome-dot" aria-hidden="true" />}
        </span>
      </header>

      <div className="flex items-center gap-2.5 px-5">
        <button onClick={onOpenSearch} aria-label="Cari film" className="search-field">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <span className="t-body-sm truncate font-light">Cari filmmu</span>
        </button>

        <button
          onClick={onOpenFilters}
          aria-label={activeFilters > 0 ? `Filter, ${activeFilters} aktif` : 'Filter'}
          className="icon-btn relative"
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
            <circle cx="16" cy="8" r="2.1" />
            <circle cx="10" cy="16" r="2.1" />
          </svg>
          {activeFilters > 0 && <span className="chrome-dot" aria-hidden="true" />}
        </button>
      </div>

      <GameSelector current={machine} onPlay={onPlay} onHighlight={onHighlight} />

      <div className="mt-6 flex flex-col gap-8">
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
