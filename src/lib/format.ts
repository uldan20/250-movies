export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}j` : `${h}j ${m}m`
}

/** Tier kelangkaan dari peringkat IMDb — dipakai untuk warna & efek hadiah. */
export type Tier = 'legendary' | 'epic' | 'rare' | 'common'

export function tierOf(rank: number): Tier {
  if (rank <= 10) return 'legendary'
  if (rank <= 50) return 'epic'
  if (rank <= 120) return 'rare'
  return 'common'
}

export const TIER_LABEL: Record<Tier, string> = {
  legendary: 'LEGENDARY',
  epic: 'EPIC',
  rare: 'RARE',
  common: 'CLASSIC',
}

/** Warna utama tiap tier (hex), dipakai canvas maupun CSS. */
export const TIER_COLOR: Record<Tier, string> = {
  legendary: '#f0a030',
  epic: '#9b59b6',
  rare: '#3b82c4',
  common: '#6bbe4e',
}
