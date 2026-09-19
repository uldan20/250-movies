import { useState } from 'react'
import { MOVIES_BY_ID } from '../data/movies'
import type { Movie } from '../data/types'
import { TIER_COLOR, formatRuntime, tierOf } from '../lib/format'
import { sfx } from '../lib/sound'
import type { HistoryEntry } from '../lib/useArcade'
import PosterImage from './PosterImage'
import SlideOver from './SlideOver'

type Props = {
  open: boolean
  history: HistoryEntry[]
  watchlist: string[]
  seen: string[]
  onToggleWatchlist: (id: string) => void
  onToggleSeen: (id: string) => void
  onClose: () => void
}

type Tab = 'history' | 'watchlist'

function Row({
  movie,
  inWatchlist,
  isSeen,
  onToggleWatchlist,
  onToggleSeen,
}: {
  movie: Movie
  inWatchlist: boolean
  isSeen: boolean
  onToggleWatchlist: () => void
  onToggleSeen: () => void
}) {
  const accent = TIER_COLOR[tierOf(movie.rank)]
  return (
    <li className="flex gap-3 border-b-2 border-ink/8 py-3 last:border-0">
      <PosterImage movie={movie} className="h-20 w-[3.4rem] shrink-0" rounded="rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{movie.title}</p>
        <p className="text-xs font-semibold text-ink/55">
          {movie.year} · {formatRuntime(movie.runtime)} · ⭐ {movie.rating.toFixed(1)}
        </p>
        <p className="mt-0.5 font-display text-xs" style={{ color: accent }}>
          #{movie.rank}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              sfx.click()
              onToggleWatchlist()
            }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              inWatchlist ? 'bg-orange text-cream' : 'bg-ink/8 text-ink/60'
            }`}
          >
            {inWatchlist ? '★ Watchlist' : '☆ Watchlist'}
          </button>
          <button
            onClick={() => {
              sfx.click()
              onToggleSeen()
            }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isSeen ? 'bg-cab text-cream' : 'bg-ink/8 text-ink/60'
            }`}
          >
            {isSeen ? '✓ Ditonton' : 'Tandai'}
          </button>
        </div>
      </div>
    </li>
  )
}

export default function CollectionPanel({
  open,
  history,
  watchlist,
  seen,
  onToggleWatchlist,
  onToggleSeen,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('history')

  // Riwayat bisa memuat film yang sama dua kali; tampilkan yang terbaru saja.
  const historyIds = [...new Set(history.map((h) => h.id))]
  const ids = tab === 'history' ? historyIds : watchlist
  const movies = ids.map((id) => MOVIES_BY_ID.get(id)).filter((m): m is Movie => m != null)

  return (
    <SlideOver open={open} title="Koleksi" onClose={onClose}>
      <div className="mb-4 flex gap-2 rounded-full bg-ink/8 p-1">
        {(
          [
            ['history', `Riwayat (${historyIds.length})`],
            ['watchlist', `Watchlist (${watchlist.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              sfx.click()
              setTab(key)
            }}
            aria-pressed={tab === key}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
              tab === key ? 'bg-cream text-ink shadow-sm' : 'text-ink/55'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {movies.length === 0 ? (
        <p className="py-12 text-center text-sm font-semibold text-ink/45">
          {tab === 'history'
            ? 'Belum ada film yang berhasil dicapit.'
            : 'Watchlist masih kosong. Tandai film dari layar hadiah.'}
        </p>
      ) : (
        <ul>
          {movies.map((m) => (
            <Row
              key={m.id}
              movie={m}
              inWatchlist={watchlist.includes(m.id)}
              isSeen={seen.includes(m.id)}
              onToggleWatchlist={() => onToggleWatchlist(m.id)}
              onToggleSeen={() => onToggleSeen(m.id)}
            />
          ))}
        </ul>
      )}
    </SlideOver>
  )
}
