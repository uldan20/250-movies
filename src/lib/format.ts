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
  legendary: 'Top 10',
  epic: 'Top 50',
  rare: 'Top 120',
  common: 'Top 250',
}

/**
 * DESIGN.md hanya mengizinkan satu warna dekoratif, jadi tier dibedakan lewat
 * label — biru sinyal hanya untuk dua tier teratas, sisanya abu netral.
 */
export const TIER_COLOR: Record<Tier, string> = {
  legendary: '#2997ff',
  epic: '#2997ff',
  rare: '#6e6e73',
  common: '#6e6e73',
}
