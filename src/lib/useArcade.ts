import { useCallback, useEffect, useMemo, useState } from 'react'
import { KEYS, readJSON, writeJSON } from './storage'
import { DEFAULT_FILTERS, type Filters, applyFilters } from './filters'
import { MOVIES } from '../data/movies'
import type { Movie } from '../data/types'

export type HistoryEntry = { id: string; at: number }

const STARTING_COINS = 12

export function useArcade() {
  const [coins, setCoins] = useState(() => readJSON<number>(KEYS.coins, STARTING_COINS))
  const [history, setHistory] = useState(() => readJSON<HistoryEntry[]>(KEYS.history, []))
  const [watchlist, setWatchlist] = useState(() => readJSON<string[]>(KEYS.watchlist, []))
  const [seen, setSeen] = useState(() => readJSON<string[]>(KEYS.seen, []))
  const [filters, setFilters] = useState<Filters>(() =>
    readJSON<Filters>(`${KEYS.settings}:filters`, DEFAULT_FILTERS),
  )

  useEffect(() => writeJSON(KEYS.coins, coins), [coins])
  useEffect(() => writeJSON(KEYS.history, history), [history])
  useEffect(() => writeJSON(KEYS.watchlist, watchlist), [watchlist])
  useEffect(() => writeJSON(KEYS.seen, seen), [seen])
  useEffect(() => writeJSON(`${KEYS.settings}:filters`, filters), [filters])

  const pool = useMemo(() => applyFilters(MOVIES, filters, seen), [filters, seen])

  const spendCoin = useCallback(() => setCoins((c) => Math.max(0, c - 1)), [])
  const addCoins = useCallback((n: number) => setCoins((c) => Math.min(99, c + n)), [])

  /**
   * @param refundCoin Kembalikan koin yang baru dipakai. Mesin yang bisa gagal
   * (mesin capit) mengembalikannya, sehingga yang mahal adalah meleset. Mesin
   * yang selalu memberi hadiah (Case Opening) tidak, kalau tidak permainannya
   * jadi gratis tanpa batas.
   */
  const recordWin = useCallback((movie: Movie, refundCoin: boolean) => {
    if (refundCoin) setCoins((c) => Math.min(99, c + 1))
    setHistory((h) => [{ id: movie.id, at: Date.now() }, ...h].slice(0, 120))
  }, [])

  const toggleWatchlist = useCallback((id: string) => {
    setWatchlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [id, ...w]))
  }, [])

  const toggleSeen = useCallback((id: string) => {
    setSeen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [id, ...s]))
  }, [])

  /**
   * Hapus satu film dari riwayat tangkapan. Satu film bisa tercatat beberapa
   * kali, jadi seluruh entri untuk film itu ikut dibuang — yang dilihat
   * pengguna adalah daftar unik, bukan tiap kejadian.
   *
   * Koin tidak dikembalikan maupun ditarik: menang sudah mengembalikan koinnya
   * saat itu juga, jadi membatalkan catatan tidak mengubah apa pun soal koin.
   */
  const removeCatch = useCallback((id: string) => {
    setHistory((h) => h.filter((entry) => entry.id !== id))
  }, [])

  const clearCatches = useCallback(() => {
    setHistory([])
  }, [])

  const removeFromWatchlist = useCallback((id: string) => {
    setWatchlist((w) => w.filter((x) => x !== id))
  }, [])

  const clearWatchlist = useCallback(() => {
    setWatchlist([])
  }, [])

  const unmarkSeen = useCallback((id: string) => {
    setSeen((s) => s.filter((x) => x !== id))
  }, [])

  const clearSeen = useCallback(() => {
    setSeen([])
  }, [])

  const resetProgress = useCallback(() => {
    setHistory([])
    setWatchlist([])
    setSeen([])
    setCoins(STARTING_COINS)
  }, [])

  return {
    coins,
    history,
    watchlist,
    seen,
    filters,
    pool,
    setFilters,
    spendCoin,
    addCoins,
    recordWin,
    toggleWatchlist,
    toggleSeen,
    removeCatch,
    clearCatches,
    removeFromWatchlist,
    clearWatchlist,
    unmarkSeen,
    clearSeen,
    resetProgress,
  }
}

export type Arcade = ReturnType<typeof useArcade>
