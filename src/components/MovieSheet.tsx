import { useEffect, useState } from 'react'
import type { Movie } from '../data/types'
import { TIER_COLOR, TIER_LABEL, formatRuntime, tierOf } from '../lib/format'
import { buildShareCard, downloadDataUrl } from '../lib/shareCard'
import { sfx } from '../lib/sound'
import PosterImage from './PosterImage'
import Sheet from './Sheet'

type Props = {
  movie: Movie
  /** Mode hadiah menambah fanfare dan tombol capit lagi. */
  prize?: boolean
  inWatchlist: boolean
  isSeen: boolean
  /** Film ini tercatat di riwayat tangkapan. */
  inHistory?: boolean
  onToggleWatchlist: () => void
  onToggleSeen: () => void
  /** Buang catatan tangkapan — berguna saat cuma coba-coba mencapit. */
  onRemoveCatch?: () => void
  onPlayAgain?: () => void
  onClose: () => void
}

export default function MovieSheet({
  movie,
  prize = false,
  inWatchlist,
  isSeen,
  inHistory = false,
  onToggleWatchlist,
  onToggleSeen,
  onRemoveCatch,
  onPlayAgain,
  onClose,
}: Props) {
  const tier = tierOf(movie.rank)
  const accent = TIER_COLOR[tier]
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    if (!prize) return
    sfx.win(tier === 'legendary')
  }, [prize, movie.id, tier])

  async function handleShare() {
    setSharing(true)
    setShareError(null)
    try {
      const dataUrl = await buildShareCard(movie)
      if (dataUrl) downloadDataUrl(dataUrl, `arcade250-${movie.id}.png`)
      else setShareError('Poster menolak diekspor. Coba lagi nanti.')
    } catch {
      setShareError('Gagal membuat kartu.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <Sheet
      open
      title={prize ? 'Kamu dapat' : 'Detail film'}
      onClose={onClose}
      footer={
        prize && onPlayAgain ? (
          <div className="flex gap-2.5">
            <button
              className="pill pill--filled flex-1"
              onClick={() => {
                sfx.chime()
                onPlayAgain()
              }}
            >
              Capit lagi
            </button>
            <button className="pill pill--quiet" onClick={onClose}>
              Tutup
            </button>
          </div>
        ) : undefined
      }
    >
      <div
        role={prize ? 'status' : undefined}
        aria-label={prize ? `Kamu mendapat ${movie.title}` : undefined}
        data-movie-id={movie.id}
        className="p-5"
      >
        <div className="flex gap-4">
          <PosterImage movie={movie} className="h-48 w-32 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="t-eyebrow" style={{ color: accent }}>
              {TIER_LABEL[tier]} · #{movie.rank}
            </p>
            <h3 className="t-heading-sm mt-1.5 font-semibold text-frost">{movie.title}</h3>
            <p className="t-body-sm mt-2 font-light text-ash">
              {movie.year} · {formatRuntime(movie.runtime)} · ⭐ {movie.rating.toFixed(1)}
            </p>
            <p className="t-body-sm mt-1 font-light text-ash">{movie.director}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {movie.genres.map((g) => (
                <span
                  key={g}
                  className="t-caption rounded-full border border-hairline px-2.5 py-1 text-ash"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="t-body mt-5 font-light text-frost/85">{movie.synopsis}</p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              sfx.click()
              onToggleWatchlist()
            }}
            className={`pill pill--sm ${inWatchlist ? 'pill--filled' : 'pill--quiet'}`}
          >
            {inWatchlist ? '✓ Di watchlist' : '+ Watchlist'}
          </button>
          <button
            onClick={() => {
              sfx.click()
              onToggleSeen()
            }}
            className={`pill pill--sm ${isSeen ? 'pill--filled' : 'pill--quiet'}`}
          >
            {isSeen ? '✓ Sudah ditonton' : 'Tandai ditonton'}
          </button>
          <button onClick={handleShare} disabled={sharing} className="pill pill--sm pill--quiet">
            {sharing ? 'Membuat…' : 'Kartu PNG'}
          </button>
          <a
            href={`https://www.imdb.com/find/?q=${encodeURIComponent(`${movie.title} ${movie.year}`)}`}
            target="_blank"
            rel="noreferrer noopener"
            className="pill pill--sm pill--quiet"
          >
            IMDb ↗
          </a>
          {onRemoveCatch && (prize || inHistory) && (
            <button
              onClick={() => {
                sfx.click()
                onRemoveCatch()
              }}
              className="pill pill--sm"
              style={{ background: '#2c2c2e', color: '#ff453a' }}
            >
              {prize ? 'Batalkan tangkapan' : 'Hapus dari tangkapan'}
            </button>
          )}
        </div>

        {onRemoveCatch && prize && (
          <p className="t-caption mt-3 font-light text-mist">
            Membatalkan hanya menghapus catatannya dari koleksi.
          </p>
        )}

        {shareError && <p className="t-caption mt-3 text-[#ff9f0a]">{shareError}</p>}
      </div>
    </Sheet>
  )
}
