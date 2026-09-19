import type { Movie } from '../data/types'
import { KEYS, readJSON, writeJSON } from './storage'

export type PosterSource = 'tmdb' | 'wikipedia'
export type PosterHit = { url: string; source: PosterSource }

type CacheEntry = { url: string; source: PosterSource; ts: number } | { miss: true; ts: number }
type Cache = Record<string, CacheEntry>

/** Hit di-cache lama; miss dicoba ulang cepat supaya kegagalan sesaat tidak menempel. */
const HIT_TTL = 1000 * 60 * 60 * 24 * 30
const MISS_TTL = 1000 * 60 * 30

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

/** Ringkasan isi cache, dipakai panel Pengaturan. */
export function posterCacheStats(): { hits: number; misses: number } {
  const c = getCache()
  let hits = 0
  let misses = 0
  for (const entry of Object.values(c)) {
    if ('miss' in entry) misses++
    else hits++
  }
  return { hits, misses }
}

/** Hapus hanya catatan kegagalan, supaya yang sudah berhasil tidak diambil ulang. */
export function retryFailedPosters() {
  const c = getCache()
  for (const [id, entry] of Object.entries(c)) {
    if ('miss' in entry) delete c[id]
  }
  writeJSON(KEYS.posters, c)
}

export function clearPosterCache() {
  cache = {}
  writeJSON(KEYS.posters, cache)
}

async function fetchJSON(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal })
  // 429 berarti diminta pelan-pelan, bukan gagal: tunggu sebentar lalu ulangi.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200))
    const retry = await fetch(url, { signal })
    if (!retry.ok) throw new Error(`HTTP ${retry.status}`)
    return retry.json()
  }
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
 * Wikipedia: tanpa API key dan mengizinkan CORS lewat origin=*.
 *
 * Dua hal yang wajib diperhatikan di sini:
 *
 * 1. `pilicense=any`. Parameter ini default-nya `free`, dan poster film di
 *    Wikipedia hampir seluruhnya non-free (fair use) — tanpa `any`, API
 *    memang sengaja tidak mengembalikan posternya sama sekali.
 * 2. Hasil teratas pencarian belum tentu punya gambar (bisa artikel daftar
 *    atau disambiguasi), jadi ambil beberapa kandidat dan pakai yang pertama
 *    punya thumbnail, mengikuti urutan relevansi dari `index`.
 */
async function searchWikipedia(query: string, signal?: AbortSignal): Promise<PosterHit | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1' +
    '&generator=search&gsrlimit=5&gsrnamespace=0' +
    `&gsrsearch=${encodeURIComponent(query)}` +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=500&pilicense=any'
  const data = await fetchJSON(url, signal)
  const pages = data?.query?.pages
  if (!pages) return null

  const ranked = (Object.values(pages) as any[]).sort(
    (a, b) => (a?.index ?? 99) - (b?.index ?? 99),
  )
  for (const page of ranked) {
    const src: string | undefined = page?.thumbnail?.source
    if (src) return { url: src, source: 'wikipedia' }
  }
  return null
}

async function fromWikipedia(movie: Movie, signal?: AbortSignal): Promise<PosterHit | null> {
  const hit = await searchWikipedia(`${movie.title} ${movie.year} film`, signal)
  if (hit) return hit
  // Judul asing dan film yang tahunnya berbeda antar rilis sering meleset
  // kalau tahunnya ikut dicari; coba sekali lagi tanpa tahun.
  return searchWikipedia(`${movie.title} film`, signal)
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

/** Antrean dengan batas paralel supaya puluhan poster tidak membanjiri API. */
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

/**
 * Satu antrean bersama untuk seluruh halaman. Tanpa ini, satu layar penuh
 * poster akan menembakkan ratusan permintaan sekaligus — yang justru memicu
 * pembatasan laju dan membuat sebagian poster gagal dimuat.
 */
export const posterQueue = createPosterQueue(4)
