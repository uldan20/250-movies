import { useEffect, useState } from 'react'
import type { Movie } from '../data/types'
import { TIER_COLOR, TIER_LABEL, formatRuntime, tierOf } from '../lib/format'
import { buildShareCard, downloadDataUrl } from '../lib/shareCard'
import { sfx } from '../lib/sound'
import PosterImage from './PosterImage'

type Props = {
  movie: Movie
  inWatchlist: boolean
  isSeen: boolean
  onToggleWatchlist: () => void
  onToggleSeen: () => void
  onPlayAgain: () => void
  onClose: () => void
}

export default function PrizeReveal({
  movie,
  inWatchlist,
  isSeen,
  onToggleWatchlist,
  onToggleSeen,
  onPlayAgain,
  onClose,
}: Props) {
  const tier = tierOf(movie.rank)
  const accent = TIER_COLOR[tier]
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    sfx.crack()
    sfx.win(tier === 'legendary')
  }, [movie.id, tier])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleShare() {
    setSharing(true)
    setShareError(null)
    try {
      const dataUrl = await buildShareCard(movie)
      if (dataUrl) downloadDataUrl(dataUrl, `arcade250-${movie.id}.png`)
      else setShareError('Poster menolak diekspor. Kartu tanpa poster bisa dicoba lagi nanti.')
    } catch {
      setShareError('Gagal membuat kartu.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Kamu mendapat ${movie.title}`}
      onClick={onClose}
    >
      <div
        className="prize-pop panel relative w-full max-w-lg overflow-hidden rounded-2xl"
        style={{ borderColor: `${accent}88` }}
        onClick={(e) => e.stopPropagation()}
      >
        {tier === 'legendary' && (
          <div className="tier-legendary-sheen pointer-events-none absolute inset-0 z-10" />
        )}

        <div
          className="px-5 py-3 text-center font-display text-[10px]"
          style={{ background: `${accent}22`, color: accent }}
        >
          {TIER_LABEL[tier]} · PERINGKAT #{movie.rank}
        </div>

        <div className="max-h-[70vh] overflow-y-auto thin-scroll p-5">
          <div className="flex gap-4">
            <PosterImage
              movie={movie}
              className="h-44 w-[7.5rem] shrink-0 shadow-lg"
            />
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight text-white">{movie.title}</h2>
              <p className="mt-1 text-sm text-white/60">
                {movie.year} · {formatRuntime(movie.runtime)}
              </p>
              <p className="mt-1 text-sm text-white/60">{movie.director}</p>
              <p className="mt-2 font-display text-[11px]" style={{ color: accent }}>
                ⭐ {movie.rating.toFixed(1)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-white/75">{movie.synopsis}</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                sfx.click()
                onToggleWatchlist()
              }}
              className="arcade-btn px-3 py-2.5 text-sm font-semibold"
              style={{
                background: inWatchlist ? `${accent}33` : undefined,
                color: inWatchlist ? accent : undefined,
              }}
            >
              {inWatchlist ? '★ Di watchlist' : '☆ Watchlist'}
            </button>
            <button
              onClick={() => {
                sfx.click()
                onToggleSeen()
              }}
              className="arcade-btn px-3 py-2.5 text-sm font-semibold"
              style={{
                background: isSeen ? 'rgba(34,211,238,0.2)' : undefined,
                color: isSeen ? '#22d3ee' : undefined,
              }}
            >
              {isSeen ? '✓ Sudah ditonton' : 'Tandai ditonton'}
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="arcade-btn px-3 py-2.5 text-sm font-semibold"
            >
              {sharing ? 'Membuat…' : '⬇ Kartu PNG'}
            </button>
            <a
              href={`https://www.imdb.com/find/?q=${encodeURIComponent(`${movie.title} ${movie.year}`)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="arcade-btn flex items-center justify-center px-3 py-2.5 text-sm font-semibold"
            >
              Cari di IMDb ↗
            </a>
          </div>

          {shareError && <p className="mt-2 text-xs text-amber-300/80">{shareError}</p>}
        </div>

        <div className="flex gap-2 border-t border-white/10 p-4">
          <button
            onClick={() => {
              sfx.coin()
              onPlayAgain()
            }}
            className="arcade-btn flex-1 px-4 py-3 font-display text-[11px] text-white"
            style={{ background: `${accent}33` }}
          >
            CAPIT LAGI
          </button>
          <button
            onClick={() => {
              sfx.click()
              onClose()
            }}
            className="arcade-btn px-4 py-3 text-sm font-semibold text-white/70"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
