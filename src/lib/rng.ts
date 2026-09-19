/** Acak bilangan bulat pada [min, max]. */
export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** Fisher–Yates pada salinan, jadi array masukan tidak diubah. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Ambil n elemen acak tanpa pengulangan (n dipangkas ke panjang array). */
export function sample<T>(items: readonly T[], n: number): T[] {
  return shuffle(items).slice(0, Math.max(0, Math.min(n, items.length)))
}
