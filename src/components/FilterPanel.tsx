import { ALL_DECADES, ALL_GENRES } from '../data/movies'
import { DEFAULT_FILTERS, type Filters } from '../lib/filters'
import { sfx } from '../lib/sound'
import SlideOver from './SlideOver'

type Props = {
  open: boolean
  filters: Filters
  matchCount: number
  onChange: (f: Filters) => void
  onClose: () => void
}

const RUNTIME_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Bebas', value: null },
  { label: '< 100 menit', value: 99 },
  { label: '< 120 menit', value: 119 },
  { label: '< 150 menit', value: 149 },
]

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={() => {
        sfx.click()
        onClick()
      }}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-neon bg-neon/25 text-white'
          : 'border-white/15 text-white/60 hover:border-white/35 hover:text-white/85'
      }`}
    >
      {children}
    </button>
  )
}

export default function FilterPanel({ open, filters, matchCount, onChange, onClose }: Props) {
  function toggleGenre(g: string) {
    onChange({
      ...filters,
      genres: filters.genres.includes(g)
        ? filters.genres.filter((x) => x !== g)
        : [...filters.genres, g],
    })
  }

  function toggleDecade(d: number) {
    onChange({
      ...filters,
      decades: filters.decades.includes(d)
        ? filters.decades.filter((x) => x !== d)
        : [...filters.decades, d],
    })
  }

  return (
    <SlideOver
      open={open}
      title="FILTER MESIN"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/60">
            <strong className="text-white">{matchCount}</strong> film masuk kabin
          </p>
          <button
            onClick={() => {
              sfx.click()
              onChange(DEFAULT_FILTERS)
            }}
            className="arcade-btn px-4 py-2 text-sm font-semibold"
          >
            Reset
          </button>
        </div>
      }
    >
      {matchCount === 0 && (
        <p className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          Tidak ada film yang cocok. Longgarkan filternya supaya kabin bisa diisi.
        </p>
      )}

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Genre</h3>
        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map((g) => (
            <Chip key={g} active={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Dekade</h3>
        <div className="flex flex-wrap gap-2">
          {ALL_DECADES.map((d) => (
            <Chip key={d} active={filters.decades.includes(d)} onClick={() => toggleDecade(d)}>
              {d}s
            </Chip>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">
          Rating minimal: <span className="text-white">{filters.minRating.toFixed(1)}</span>
        </h3>
        <input
          type="range"
          min={0}
          max={9}
          step={0.1}
          value={filters.minRating}
          onChange={(e) => onChange({ ...filters, minRating: Number(e.target.value) })}
          className="w-full accent-[#ec4899]"
          aria-label="Rating IMDb minimal"
        />
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Durasi</h3>
        <div className="flex flex-wrap gap-2">
          {RUNTIME_OPTIONS.map((opt) => (
            <Chip
              key={opt.label}
              active={filters.maxRuntime === opt.value}
              onClick={() => onChange({ ...filters, maxRuntime: opt.value })}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={filters.hideSeen}
            onChange={(e) => onChange({ ...filters, hideSeen: e.target.checked })}
            className="h-4 w-4 accent-[#ec4899]"
          />
          Sembunyikan film yang sudah saya tonton
        </label>
      </section>
    </SlideOver>
  )
}
