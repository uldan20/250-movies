import { useMemo, useState } from 'react'
import { MOVIES } from '../data/movies'
import type { Movie } from '../data/types'
import { PosterTile, Screen } from './ui'

type Props = {
  onSelectMovie: (m: Movie) => void
}

export default function SearchScreen({ onSelectMovie }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return MOVIES.slice(0, 30)
    return MOVIES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.director.toLowerCase().includes(q) ||
        m.genres.some((g) => g.toLowerCase().includes(q)) ||
        String(m.year).includes(q),
    ).slice(0, 60)
  }, [query])

  return (
    <Screen>
      <div className="px-5 pb-4 pt-3">
        <h1 className="t-heading mb-4 font-bold text-frost">Cari</h1>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mist"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Judul, sutradara, genre, tahun"
            aria-label="Cari film"
            className="t-body w-full rounded-[8px] border border-hairline bg-carbon py-2.5 pl-10 pr-3 font-light text-frost placeholder:text-mist focus:border-apple-blue focus:outline-none"
          />
        </div>
        <p className="t-caption mt-2.5 text-mist">
          {query.trim() ? `${results.length} hasil` : 'Menampilkan 30 peringkat teratas'}
        </p>
      </div>

      {results.length === 0 ? (
        <p className="t-body px-5 py-16 text-center font-light text-mist">
          Tidak ada film yang cocok dengan “{query}”.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-5 sm:grid-cols-4 md:grid-cols-5">
          {results.map((m) => (
            <PosterTile key={m.id} movie={m} onSelect={onSelectMovie} width="w-full" />
          ))}
        </div>
      )}
    </Screen>
  )
}
