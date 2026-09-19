import { useEffect, useState } from 'react'
import type { Movie } from '../data/types'
import { resolvePoster } from '../lib/posters'
import { TIER_COLOR, tierOf } from '../lib/format'

type Props = {
  movie: Movie
  className?: string
  rounded?: string
}

/**
 * Poster asli diambil di browser pengunjung (TMDB bila ada key, kalau tidak
 * Wikipedia). Selama menunggu — dan kalau dua-duanya gagal — yang tampil adalah
 * kartu bergaya, bukan kotak kosong.
 */
export default function PosterImage({ movie, className = '', rounded = 'rounded-xl' }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    setUrl(null)
    setFailed(false)
    resolvePoster(movie, controller.signal)
      .then((hit) => {
        if (alive) {
          if (hit) setUrl(hit.url)
          else setFailed(true)
        }
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
      controller.abort()
    }
  }, [movie])

  const color = TIER_COLOR[tierOf(movie.rank)]

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={`Poster ${movie.title}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} ${rounded} bg-glass object-cover`}
      />
    )
  }

  return (
    <div
      className={`${className} ${rounded} relative flex items-center justify-center overflow-hidden`}
      style={{ background: color }}
      role="img"
      aria-label={`Poster ${movie.title} tidak tersedia`}
    >
      <div className="absolute inset-0 bg-ink/35" />
      <div className="relative px-2 text-center">
        <div className="font-display text-sm text-cream">#{movie.rank}</div>
        <div className="mt-1 line-clamp-3 text-xs font-bold leading-tight text-cream/90">
          {movie.title}
        </div>
        <div className="mt-1 text-[10px] font-semibold text-cream/60">{movie.year}</div>
      </div>
    </div>
  )
}
