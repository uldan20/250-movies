import { useEffect, useRef, useState } from 'react'
import type { Movie } from '../data/types'
import { posterQueue } from '../lib/posters'

type Props = {
  movie: Movie
  className?: string
  rounded?: string
}

/**
 * Poster asli diambil di browser pengunjung (TMDB bila ada key, kalau tidak
 * Wikipedia). Dua hal yang menjaga halaman tetap sehat:
 *
 * - permintaan baru dikirim saat poster mendekati viewport, dan
 * - semuanya lewat satu antrean bersama dengan batas paralel.
 *
 * Selama menunggu — dan kalau semua sumber gagal — yang tampil kartu
 * tipografis, bukan kotak kosong.
 */
export default function PosterImage({ movie, className = '', rounded = 'rounded-[8px]' }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px' },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let alive = true
    setUrl(null)
    setFailed(false)
    posterQueue(movie)
      .then((hit) => {
        if (!alive) return
        if (hit) setUrl(hit.url)
        else setFailed(true)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [movie, visible])

  if (url && !failed) {
    return (
      <img
        ref={hostRef as unknown as React.RefObject<HTMLImageElement>}
        src={url}
        alt={`Poster ${movie.title}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} ${rounded} bg-carbon object-cover`}
      />
    )
  }

  return (
    <div
      ref={hostRef}
      className={`${className} ${rounded} flex items-center justify-center`}
      style={{ background: 'linear-gradient(150deg, #26262a, #0d0d0f)' }}
      role="img"
      aria-label={`Poster ${movie.title} tidak tersedia`}
    >
      <span className="t-subheading font-semibold text-mist">#{movie.rank}</span>
    </div>
  )
}
