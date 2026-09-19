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
        className={`${className} ${rounded} object-cover bg-deep`}
      />
    )
  }

  return (
    <div
      className={`${className} ${rounded} relative overflow-hidden flex items-center justify-center`}
      style={{ background: `linear-gradient(150deg, ${color}33, #0c0620)` }}
      aria-label={`Poster ${movie.title} tidak tersedia`}
role="img"
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(circle at 30% 20%, ${color}, transparent 60%)` }}
      />
      <div className="relative px-2 text-center">
        <div className="font-display text-[9px] leading-relaxed" style={{ color }}>
          #{movie.rank}
        </div>
        <div className="mt-1 text-xs font-bold leading-tight text-white/90 line-clamp-3">
          {movie.title}
        </div>
        <div className="mt-1 text-[10px] text-white/50">{movie.year}</div>
      </div>
    </div>
  )
}
