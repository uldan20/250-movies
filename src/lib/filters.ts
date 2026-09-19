import type { Movie } from '../data/types'

export type Filters = {
  genres: string[]
  decades: number[]
  minRating: number
  maxRuntime: number | null
  hideSeen: boolean
}

export const DEFAULT_FILTERS: Filters = {
  genres: [],
  decades: [],
  minRating: 0,
  maxRuntime: null,
  hideSeen: false,
}

export function applyFilters(movies: Movie[], filters: Filters, seen: string[]): Movie[] {
  const seenSet = new Set(seen)
  return movies.filter((m) => {
    if (filters.genres.length > 0 && !m.genres.some((g) => filters.genres.includes(g))) return false
    if (filters.decades.length > 0) {
      const decade = Math.floor(m.year / 10) * 10
      if (!filters.decades.includes(decade)) return false
    }
    if (m.rating < filters.minRating) return false
    if (filters.maxRuntime != null && m.runtime > filters.maxRuntime) return false
    if (filters.hideSeen && seenSet.has(m.id)) return false
    return true
  })
}

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.genres.length === 0 &&
    f.decades.length === 0 &&
    f.minRating === 0 &&
    f.maxRuntime == null &&
    !f.hideSeen
  )
}

export function countActive(f: Filters): number {
  let n = 0
  if (f.genres.length) n++
  if (f.decades.length) n++
  if (f.minRating > 0) n++
  if (f.maxRuntime != null) n++
  if (f.hideSeen) n++
  return n
}
