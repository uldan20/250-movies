export type Movie = {
  /** Peringkat pada snapshot IMDb Top 250 yang di-bundle. */
  rank: number
  title: string
  year: number
  rating: number
  /** Durasi dalam menit. */
  runtime: number
  genres: string[]
  director: string
  synopsis: string
  /** Kunci stabil untuk cache poster & localStorage. */
  id: string
}

/** Bentuk mentah di movies.ts — dipadatkan supaya file tetap bisa dibaca manusia. */
export type MovieRow = [
  rank: number,
  title: string,
  year: number,
  rating: number,
  runtime: number,
  genres: string,
  director: string,
  synopsis: string,
]
