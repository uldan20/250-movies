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
      else setShareError('Poster menolak diekspor. Coba lagi nanti.')
    } catch {
      setShareError('Gagal membuat kartu.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Kamu mendapat ${movie.title}`}
      onClick={onClose}
    >
      <div
        className="prize-pop card relative w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* pita tier di kepala kartu, seperti label hadiah */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ background: accent }}
        >
          <span className="font-display text-sm text-cream">{TIER_LABEL[tier]}</span>
          <span className="font-display text-lg text-cream">#{movie.rank}</span>
        </div>

        <div className="thin-scroll max-h-[64vh] overflow-y-auto p-5">
          <div className="flex gap-4">
            <PosterImage
              movie={movie}
              className="h-44 w-[7.5rem] shrink-0 shadow-[0_8px_18px_-8px_rgba(35,66,61,0.7)]"
            />
            <div className="min-w-0">
              <h2 className="font-display text-xl leading-snug text-ink">{movie.title}</h2>
              <p className="mt-1 text-sm font-semibold text-ink/60">
                {movie.year} · {formatRuntime(movie.runtime)}
              </p>
              <p className="text-sm font-semibold text-ink/60">{movie.director}</p>
              <p className="mt-2 inline-block rounded-full bg-orange/20 px-2.5 py-1 text-sm font-bold text-[#b9641a]">
                ⭐ {movie.rating.toFixed(1)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-ink/8 px-2.5 py-1 text-[11px] font-bold text-ink/65"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm font-semibold leading-relaxed text-ink/75">{movie.synopsis}</p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                sfx.click()
                onToggleWatchlist()
              }}
              className="toy-btn toy-btn--cream px-3 py-3 text-sm"
              style={
                inWatchlist
                  ? {
                      background: 'linear-gradient(180deg,#f5a44c,#f08a2e)',
                      color: '#fdfbf3',
                      boxShadow: '0 5px 0 0 #b9641a, inset 0 2px 0 rgba(255,255,255,0.4)',
                    }
                  : undefined
              }
            >
              {inWatchlist ? '★ Di watchlist' : '☆ Watchlist'}
            </button>
            <button
              onClick={() => {
                sfx.click()
                onToggleSeen()
              }}
              className="toy-btn toy-btn--cream px-3 py-3 text-sm"
              style={
                isSeen
                  ? {
                      background: 'linear-gradient(180deg,#aeda63,#8cc63f)',
                      color: '#fdfbf3',
                      boxShadow: '0 5px 0 0 #4c7a1e, inset 0 2px 0 rgba(255,255,255,0.4)',
                    }
                  : undefined
              }
            >
              {isSeen ? '✓ Sudah ditonton' : 'Tandai ditonton'}
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="toy-btn toy-btn--cream px-3 py-3 text-sm"
            >
              {sharing ? 'Membuat…' : '⬇ Kartu PNG'}
            </button>
            <a
              href={`https://www.imdb.com/find/?q=${encodeURIComponent(`${movie.title} ${movie.year}`)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="toy-btn toy-btn--cream flex items-center justify-center px-3 py-3 text-sm"
            >
              Cari di IMDb ↗
            </a>
          </div>

          {shareError && (
            <p className="mt-2.5 text-xs font-bold text-[#a85a12]">{shareError}</p>
          )}
        </div>

        <div className="flex gap-2.5 border-t-2 border-ink/10 p-4">
          <button
            onClick={() => {
              sfx.coin()
              onPlayAgain()
            }}
            className="toy-btn flex-1 px-4 py-3.5 text-base"
          >
            CAPIT LAGI
          </button>
          <button
            onClick={() => {
              sfx.click()
              onClose()
            }}
            className="toy-btn toy-btn--cream px-5 py-3.5 text-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
