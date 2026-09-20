import type { ReactNode } from 'react'
import type { Movie } from '../data/types'
import { formatRuntime } from '../lib/format'
import PosterImage from './PosterImage'

/** Kartu poster potret, radius 8px sesuai sistem. */
export function PosterTile({
  movie,
  onSelect,
  width = 'w-[124px]',
}: {
  movie: Movie
  onSelect: (m: Movie) => void
  width?: string
}) {
  return (
    <button
      onClick={() => onSelect(movie)}
      className={`${width} group text-left`}
      aria-label={`${movie.title} (${movie.year})`}
    >
      <PosterImage
        movie={movie}
        className="aspect-[2/3] w-full transition-opacity group-hover:opacity-85"
        rounded="rounded-[8px]"
      />
      <p className="t-body-sm mt-2 line-clamp-2 font-medium text-frost">{movie.title}</p>
      <p className="t-caption mt-0.5 text-mist">
        {movie.year} · {formatRuntime(movie.runtime)}
      </p>
    </button>
  )
}

/** Ubin persegi ala ikon aplikasi, dipakai baris "baru kamu capit". */
export function IconTile({ movie, onSelect }: { movie: Movie; onSelect: (m: Movie) => void }) {
  return (
    <button
      onClick={() => onSelect(movie)}
      className="w-[84px] text-left"
      aria-label={`${movie.title} (${movie.year})`}
    >
      <PosterImage
        movie={movie}
        className="aspect-square w-full transition-opacity hover:opacity-85"
        rounded="rounded-[18px]"
      />
      <p className="t-caption mt-2 line-clamp-2 text-ash">{movie.title}</p>
    </button>
  )
}

export function SectionHeader({
  title,
  onMore,
  moreLabel,
}: {
  title: string
  onMore?: () => void
  moreLabel?: string
}) {
  return (
    <div className="mb-3 flex items-baseline gap-1.5 px-5">
      {onMore ? (
        <button
          onClick={onMore}
          className="flex items-baseline gap-1.5 text-left"
          aria-label={moreLabel ?? `Pasang filter ${title} ke mesin`}
        >
          <h2 className="t-heading-sm font-semibold text-frost">{title}</h2>
          <span aria-hidden="true" className="t-subheading font-semibold text-mist">
            ›
          </span>
        </button>
      ) : (
        <h2 className="t-heading-sm font-semibold text-frost">{title}</h2>
      )}
    </div>
  )
}

export function Shelf({ children }: { children: ReactNode }) {
  return <div className="shelf pb-1">{children}</div>
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="fade-in pb-28">{children}</div>
}

/**
 * Pengaturan harus bisa dibuka dari layar mana pun — kode sync ada di sana,
 * dan sebelumnya tombolnya cuma ada di Beranda.
 */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Pengaturan"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carbon text-ash transition-colors hover:text-frost"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.17a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.93-1.16l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10.3 4.6V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0 1.2 2.87H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.01z" />
      </svg>
    </button>
  )
}

/** Judul besar ala iOS di kepala tiap tab. */
export function LargeTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-5 pb-4 pt-3">
      <h1 className="t-heading font-bold text-frost">{title}</h1>
      {action}
    </div>
  )
}
