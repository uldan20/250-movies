import type { Movie } from '../data/types'
import { KEYS, readJSON, writeJSON } from './storage'

export type PosterSource = 'tmdb' | 'wikipedia'
export type PosterHit = { url: string; source: PosterSource }

type CacheEntry = { url: string; source: PosterSource; ts: number } | { miss: true; ts: number }
type Cache = Record<string, CacheEntry>

/** Hit di-cache lama; miss dicoba ulang setelah sehari (mungkin sumbernya cuma sedang down). */
const HIT_TTL = 1000 * 60 * 60 * 24 * 30
const MISS_TTL = 1000 * 60 * 60 * 24

let cache: Cache | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null

function getCache(): Cache {
  if (cache == null) cache = readJSON<Cache>(KEYS.posters, {})
  return cache
}

/** Tulis ke localStorage ditunda supaya puluhan resolve tidak memicu puluhan serialisasi. */
function scheduleFlush() {
  if (flushTimer != null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    writeJSON(KEYS.posters, getCache())
  }, 400)
}

function readCache(id: string): PosterHit | 'miss' | null {
  const entry = getCache()[id]
  if (!entry) return null
  const age = Date.now() - entry.ts
  if ('miss' in entry) return age < MISS_TTL ? 'miss' : null
  return age < HIT_TTL ? { url: entry.url, source: entry.source } : null
}

function writeCache(id: string, hit: PosterHit | null) {
  getCache()[id] = hit ? { ...hit, ts: Date.now() } : { miss: true, ts: Date.now() }
  scheduleFlush()
}

export function clearPosterCache() {
  cache = {}
  writeJSON(KEYS.posters, cache)
}

async function fetchJSON(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * TMDB: butuh API key gratis milik pengunjung. Dicari lewat judul+tahun karena
 * itu jauh lebih tahan salah daripada menyimpan ID IMDb hasil tebakan.
 */
async function fromTmdb(movie: Movie, key: string, signal?: AbortSignal): Promise<PosterHit | null> {
  const url =
    `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(movie.title)}&year=${movie.year}&include_adult=false`
  const data = await fetchJSON(url, signal)
  const path: string | undefined = data?.results?.find((r: any) => r?.poster_path)?.poster_path
  if (!path) return null
  return { url: `https://image.tmdb.org/t/p/w342${path}`, source: 'tmdb' }
}

/**
 * Wikipedia: tanpa API key dan mengizinkan CORS lewat origin=*. Artikel film
 * hampir selalu memakai posternya sebagai gambar utama halaman.
 */
async function fromWikipedia(movie: Movie, signal?: AbortSignal): Promise<PosterHit | null> {
  const search = `${movie.title} ${movie.year} film`
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrlimit=1&gsrnamespace=0' +
    `&gsrsearch=${encodeURIComponent(search)}` +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=400'
  const data = await fetchJSON(url, signal)
  const pages = data?.query?.pages
  if (!pages) return null
  const first: any = Object.values(pages)[0]
  const src: string | undefined = first?.thumbnail?.source
  if (!src) return null
  return { url: src, source: 'wikipedia' }
}

export function getTmdbKey(): string {
  return readJSON<{ tmdbKey?: string }>(KEYS.settings, {}).tmdbKey ?? ''
}

/**
 * TMDB dulu bila ada key, lalu Wikipedia. Hasil (termasuk kegagalan) di-cache
 * supaya kunjungan berikutnya tidak memanggil jaringan sama sekali.
 */
export async function resolvePoster(movie: Movie, signal?: AbortSignal): Promise<PosterHit | null> {
  const cached = readCache(movie.id)
  if (cached === 'miss') return null
  if (cached) return cached

  const key = getTmdbKey().trim()
  if (key) {
    try {
      const hit = await fromTmdb(movie, key, signal)
      if (hit) {
        writeCache(movie.id, hit)
        return hit
      }
    } catch {
      /* key salah, kuota habis, atau offline — turun ke Wikipedia */
    }
  }

  try {
    const hit = await fromWikipedia(movie, signal)
    writeCache(movie.id, hit)
    return hit
  } catch {
    // Kegagalan jaringan tidak di-cache: koneksi bisa pulih sebentar lagi.
    return null
  }
}

/** Antrean dengan batas paralel supaya puluhan kapsul tidak membanjiri API. */
export function createPosterQueue(concurrency = 4) {
  const pending: Array<() => void> = []
  let active = 0

  function next() {
    if (active >= concurrency) return
    const job = pending.shift()
    if (!job) return
    active++
    job()
  }

  return function enqueue(movie: Movie): Promise<PosterHit | null> {
    const cached = readCache(movie.id)
    if (cached === 'miss') return Promise.resolve(null)
    if (cached) return Promise.resolve(cached)

    return new Promise((resolve) => {
      pending.push(() => {
        resolvePoster(movie)
          .then(resolve)
          .catch(() => resolve(null))
          .finally(() => {
            active--
            next()
          })
      })
      next()
    })
  }
}
