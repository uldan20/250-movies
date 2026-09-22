import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KEYS, readJSON, writeJSON } from './storage'
import { DEFAULT_FILTERS, type Filters, applyFilters } from './filters'
import { MOVIES } from '../data/movies'
import type { Movie } from '../data/types'
import {
  clearSyncState,
  pullState,
  pushState,
  readSyncState,
  writeSyncState,
  type SyncData,
} from './sync'

export type HistoryEntry = { id: string; at: number }

export type SyncStatus =
  | 'off'
  | 'connecting'
  | 'synced'
  | 'offline'
  | 'not_configured'
  | 'error'

const PUSH_DEBOUNCE_MS = 800

export function useArcade() {
  const [history, setHistory] = useState(() => readJSON<HistoryEntry[]>(KEYS.history, []))
  const [watchlist, setWatchlist] = useState(() => readJSON<string[]>(KEYS.watchlist, []))
  const [seen, setSeen] = useState(() => readJSON<string[]>(KEYS.seen, []))
  const [filters, setFilters] = useState<Filters>(() =>
    readJSON<Filters>(`${KEYS.settings}:filters`, DEFAULT_FILTERS),
  )

  useEffect(() => writeJSON(KEYS.history, history), [history])
  useEffect(() => writeJSON(KEYS.watchlist, watchlist), [watchlist])
  useEffect(() => writeJSON(KEYS.seen, seen), [seen])
  useEffect(() => writeJSON(`${KEYS.settings}:filters`, filters), [filters])

  // ---------- sinkronisasi antar perangkat ----------

  const initialSync = useRef(readSyncState())
  const [syncCode, setSyncCode] = useState<string | null>(initialSync.current.code)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    initialSync.current.code ? 'connecting' : 'off',
  )
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  const versionRef = useRef(initialSync.current.version)
  /** Perubahan yang berasal dari server tidak boleh memicu pengiriman balik. */
  const skipPush = useRef(false)
  /** Sebelum tarikan pertama selesai, jangan mengirim apa pun — isi lokal bisa menimpa server. */
  const [syncReady, setSyncReady] = useState(initialSync.current.code == null)

  const applyRemote = useCallback((data: SyncData) => {
    skipPush.current = true
    setHistory(data.history)
    setWatchlist(data.watchlist)
    setSeen(data.seen)
  }, [])

  const snapshot = useCallback(
    (): SyncData => ({ history, watchlist, seen }),
    [history, watchlist, seen],
  )
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot

  const pull = useCallback(
    async (code: string) => {
      setSyncStatus('connecting')
      const res = await pullState(code)
      if (!res.ok) {
        setSyncStatus(res.reason === 'offline' ? 'offline' : res.reason)
        setSyncReady(true)
        return
      }
      versionRef.current = res.version
      writeSyncState({ code, version: res.version })
      if (res.data) {
        applyRemote(res.data)
      } else {
        // Server masih kosong: perangkat ini yang menaburkan isinya.
        skipPush.current = false
      }
      setSyncStatus('synced')
      setLastSyncedAt(Date.now())
      setSyncReady(true)
    },
    [applyRemote],
  )

  // Tarikan pertama saat aplikasi dibuka dengan kode aktif.
  useEffect(() => {
    if (!syncCode || syncReady) return
    void pull(syncCode)
  }, [pull, syncCode, syncReady])

  // Tarik ulang saat tab kembali dilihat, supaya perangkat lain terlihat.
  useEffect(() => {
    if (!syncCode) return
    const onFocus = () => {
      if (document.visibilityState === 'visible') void pull(syncCode)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [pull, syncCode])

  // Kirim perubahan lokal, ditunda sebentar supaya beberapa perubahan beruntun
  // menjadi satu permintaan.
  useEffect(() => {
    if (!syncCode || !syncReady) return
    if (skipPush.current) {
      skipPush.current = false
      return
    }
    const timer = window.setTimeout(async () => {
      const res = await pushState(syncCode, versionRef.current, snapshotRef.current())
      if (res.ok) {
        versionRef.current = res.version
        writeSyncState({ code: syncCode, version: res.version })
        setSyncStatus('synced')
        setLastSyncedAt(Date.now())
        return
      }
      if (res.reason === 'conflict') {
        // Perangkat lain lebih dulu; server yang jadi acuan.
        versionRef.current = res.version
        writeSyncState({ code: syncCode, version: res.version })
        if (res.data) applyRemote(res.data)
        setSyncStatus('synced')
        setLastSyncedAt(Date.now())
        return
      }
      setSyncStatus(res.reason === 'offline' ? 'offline' : res.reason)
    }, PUSH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [applyRemote, history, watchlist, seen, syncCode, syncReady])

  const connectSync = useCallback(
    (code: string) => {
      versionRef.current = 0
      writeSyncState({ code, version: 0 })
      setSyncCode(code)
      setSyncReady(false)
      setSyncStatus('connecting')
    },
    [],
  )

  const disconnectSync = useCallback(() => {
    clearSyncState()
    setSyncCode(null)
    setSyncStatus('off')
    setSyncReady(true)
    versionRef.current = 0
  }, [])

  const syncNow = useCallback(() => {
    if (syncCode) void pull(syncCode)
  }, [pull, syncCode])

  // ---------- aksi permainan ----------

  const pool = useMemo(() => applyFilters(MOVIES, filters, seen), [filters, seen])

  /** Mesin boleh dimainkan sesuka hati: yang dicatat hanya filmnya. */
  const recordWin = useCallback((movie: Movie) => {
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
   * kali, jadi seluruh entri untuk film itu ikut dibuang.
   */
  const removeCatch = useCallback((id: string) => {
    setHistory((h) => h.filter((entry) => entry.id !== id))
  }, [])

  const clearCatches = useCallback(() => setHistory([]), [])
  const removeFromWatchlist = useCallback(
    (id: string) => setWatchlist((w) => w.filter((x) => x !== id)),
    [],
  )
  const clearWatchlist = useCallback(() => setWatchlist([]), [])
  const unmarkSeen = useCallback((id: string) => setSeen((s) => s.filter((x) => x !== id)), [])
  const clearSeen = useCallback(() => setSeen([]), [])

  const resetProgress = useCallback(() => {
    setHistory([])
    setWatchlist([])
    setSeen([])
  }, [])

  return {
    history,
    watchlist,
    seen,
    filters,
    pool,
    setFilters,
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
    sync: {
      code: syncCode,
      status: syncStatus,
      lastSyncedAt,
      connect: connectSync,
      disconnect: disconnectSync,
      refresh: syncNow,
    },
  }
}

export type Arcade = ReturnType<typeof useArcade>
