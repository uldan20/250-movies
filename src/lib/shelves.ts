import { MOVIES, MOVIES_BY_ID } from '../data/movies'
import type { Movie } from '../data/types'
import type { Filters } from './filters'
import { DEFAULT_FILTERS } from './filters'

export type Shelf = {
  id: string
  title: string
  movies: Movie[]
  /** Filter yang dipasang ke mesin saat judul rak ditekan. */
  filter?: Filters
}

function byRank(a: Movie, b: Movie) {
  return a.rank - b.rank
}

function resolve(ids: string[]): Movie[] {
  return ids.map((id) => MOVIES_BY_ID.get(id)).filter((m): m is Movie => m != null)
}

/**
 * Baris konten di layar utama. Rak yang kosong tidak dikembalikan sama sekali,
 * jadi halaman tidak pernah menampilkan judul tanpa isi.
 */
export function buildShelves(history: string[], watchlist: string[]): Shelf[] {
  const shelves: Shelf[] = []

  const continueRow = resolve([...new Set(history)]).slice(0, 20)
  if (continueRow.length > 0) {
    shelves.push({ id: 'continue', title: 'Baru kamu capit', movies: continueRow })
  }

  const watchRow = resolve(watchlist).slice(0, 20)
  if (watchRow.length > 0) {
    shelves.push({ id: 'watchlist', title: 'Watchlist kamu', movies: watchRow })
  }

  shelves.push({
    id: 'top',
    title: 'Peringkat teratas',
    movies: MOVIES.slice(0, 24),
    filter: { ...DEFAULT_FILTERS, minRating: 8.5 },
  })

  shelves.push({
    id: 'short',
    title: 'Selesai di bawah 100 menit',
    movies: MOVIES.filter((m) => m.runtime < 100)
      .sort(byRank)
      .slice(0, 24),
    filter: { ...DEFAULT_FILTERS, maxRuntime: 99 },
  })

  shelves.push({
    id: 'animation',
    title: 'Animasi',
    movies: MOVIES.filter((m) => m.genres.includes('Animation')).sort(byRank),
    filter: { ...DEFAULT_FILTERS, genres: ['Animation'] },
  })

  shelves.push({
    id: 'thriller',
    title: 'Thriller & misteri',
    movies: MOVIES.filter((m) => m.genres.some((g) => g === 'Thriller' || g === 'Mystery'))
      .sort(byRank)
      .slice(0, 24),
    filter: { ...DEFAULT_FILTERS, genres: ['Thriller', 'Mystery'] },
  })

  shelves.push({
    id: 'classic',
    title: 'Klasik sebelum 1970',
    movies: MOVIES.filter((m) => m.year < 1970)
      .sort(byRank)
      .slice(0, 24),
    filter: { ...DEFAULT_FILTERS, decades: [1920, 1930, 1940, 1950, 1960] },
  })

  shelves.push({
    id: 'nineties',
    title: 'Era 1990-an',
    movies: MOVIES.filter((m) => m.year >= 1990 && m.year < 2000)
      .sort(byRank)
      .slice(0, 24),
    filter: { ...DEFAULT_FILTERS, decades: [1990] },
  })

  return shelves.filter((s) => s.movies.length > 0)
}
