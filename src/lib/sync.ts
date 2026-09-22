import type { HistoryEntry } from './useArcade'
import { KEYS, readJSON, removeKey, writeJSON } from './storage'

/** Isi yang dibagikan antar perangkat. Filter sengaja tidak ikut: itu preferensi per-perangkat. */
export type SyncData = {
  history: HistoryEntry[]
  watchlist: string[]
  seen: string[]
}

export type SyncState = {
  code: string | null
  version: number
}

export type PullResult =
  | { ok: true; version: number; data: SyncData | null }
  | { ok: false; reason: 'offline' | 'not_configured' | 'error' }

export type PushResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'conflict'; version: number; data: SyncData | null }
  | { ok: false; reason: 'offline' | 'not_configured' | 'error' }

const SYNC_KEY = `${KEYS.settings}:sync`
/** Tanpa 0/O/1/I/L supaya kodenya tidak salah baca saat disalin manual. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function generateCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(code)
}

export function readSyncState(): SyncState {
  return readJSON<SyncState>(SYNC_KEY, { code: null, version: 0 })
}

export function writeSyncState(state: SyncState): void {
  writeJSON(SYNC_KEY, state)
}

export function clearSyncState(): void {
  removeKey(SYNC_KEY)
}

function failureReason(status: number): 'not_configured' | 'error' {
  return status === 503 ? 'not_configured' : 'error'
}

export async function pullState(code: string): Promise<PullResult> {
  try {
    const res = await fetch(`/api/state?code=${encodeURIComponent(code)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, reason: failureReason(res.status) }
    const body = await res.json()
    return { ok: true, version: Number(body.version ?? 0), data: body.data ?? null }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}

export async function pushState(
  code: string,
  version: number,
  data: SyncData,
): Promise<PushResult> {
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, version, data }),
    })
    if (res.status === 409) {
      const body = await res.json()
      return {
        ok: false,
        reason: 'conflict',
        version: Number(body.version ?? 0),
        data: body.data ?? null,
      }
    }
    if (!res.ok) return { ok: false, reason: failureReason(res.status) }
    const body = await res.json()
    return { ok: true, version: Number(body.version ?? 0) }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}
