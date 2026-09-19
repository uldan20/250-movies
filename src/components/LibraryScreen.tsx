import { useState } from 'react'
import { MOVIES_BY_ID } from '../data/movies'
import type { Movie } from '../data/types'
import { sfx } from '../lib/sound'
import { PosterTile, Screen } from './ui'

type Tab = 'history' | 'watchlist' | 'seen'

type Props = {
  history: string[]
  watchlist: string[]
  seen: string[]
  onSelectMovie: (m: Movie) => void
}

const EMPTY: Record<Tab, string> = {
  history: 'Belum ada film yang berhasil kamu capit.',
  watchlist: 'Watchlist masih kosong. Tambahkan dari detail film mana pun.',
  seen: 'Belum ada film yang kamu tandai sudah ditonton.',
}

export default function LibraryScreen({ history, watchlist, seen, onSelectMovie }: Props) {
  const [tab, setTab] = useState<Tab>('history')

  const source: Record<Tab, string[]> = {
    history: [...new Set(history)],
    watchlist,
    seen,
  }
  const movies = source[tab]
    .map((id) => MOVIES_BY_ID.get(id))
    .filter((m): m is Movie => m != null)

  return (
    <Screen>
      <div className="px-5 pb-4 pt-3">
        <h1 className="t-heading mb-4 font-bold text-frost">Koleksi</h1>
        <div className="flex gap-1 rounded-[8px] border border-hairline bg-carbon p-1">
          {(
            [
              ['history', `Ditangkap (${source.history.length})`],
              ['watchlist', `Watchlist (${watchlist.length})`],
              ['seen', `Ditonton (${seen.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                sfx.click()
                setTab(key)
              }}
              aria-pressed={tab === key}
              className={`t-body-sm flex-1 rounded-[6px] px-2 py-2 font-medium transition-colors ${
                tab === key ? 'bg-slate text-frost' : 'text-mist hover:text-ash'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {movies.length === 0 ? (
        <p className="t-body px-8 py-16 text-center font-light text-mist">{EMPTY[tab]}</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-5 sm:grid-cols-4 md:grid-cols-5">
          {movies.map((m) => (
            <PosterTile key={m.id} movie={m} onSelect={onSelectMovie} width="w-full" />
          ))}
        </div>
      )}
    </Screen>
  )
}
