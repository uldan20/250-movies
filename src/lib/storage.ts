/**
 * Pembungkus localStorage yang tidak pernah melempar. Mode privat, site data
 * yang diblokir, dan iframe sandbox semuanya bisa membuat akses localStorage
 * gagal, jadi setiap pembacaan punya nilai default.
 */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* penyimpanan penuh atau diblokir — fitur tetap jalan, cuma tidak persisten */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* diabaikan dengan sengaja */
  }
}

export const KEYS = {
  coins: 'arcade250:coins',
  history: 'arcade250:history',
  watchlist: 'arcade250:watchlist',
  seen: 'arcade250:seen',
  settings: 'arcade250:settings',
  posters: 'arcade250:posters:v1',
} as const
