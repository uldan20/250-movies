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
      className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
        active
          ? 'bg-cab text-cream shadow-[0_3px_0_var(--color-cab-base)]'
          : 'bg-ink/8 text-ink/65 hover:bg-ink/15'
      }`}
    >
      {children}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 font-display text-sm text-ink/70">{children}</h3>
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
      title="Filter mesin"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink/65">
            <strong className="font-display text-base text-ink">{matchCount}</strong> film masuk
            kabin
          </p>
          <button
            onClick={() => {
              sfx.click()
              onChange(DEFAULT_FILTERS)
            }}
            className="toy-btn toy-btn--cream px-4 py-2.5 text-sm"
          >
            Reset
          </button>
        </div>
      }
    >
      {matchCount === 0 && (
        <p className="mb-5 rounded-xl bg-orange/20 px-4 py-3 text-sm font-semibold text-[#a85a12]">
          Tidak ada film yang cocok. Longgarkan filternya supaya kabin bisa diisi.
        </p>
      )}

      <section className="mb-7">
        <SectionTitle>Genre</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map((g) => (
            <Chip key={g} active={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mb-7">
        <SectionTitle>Dekade</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {ALL_DECADES.map((d) => (
            <Chip key={d} active={filters.decades.includes(d)} onClick={() => toggleDecade(d)}>
              {d}s
            </Chip>
          ))}
        </div>
      </section>

      <section className="mb-7">
        <SectionTitle>
          Rating minimal: <span className="text-ink">{filters.minRating.toFixed(1)}</span>
        </SectionTitle>
        <input
          type="range"
          min={0}
          max={9}
          step={0.1}
          value={filters.minRating}
          onChange={(e) => onChange({ ...filters, minRating: Number(e.target.value) })}
          className="w-full accent-[#8cc63f]"
          aria-label="Rating IMDb minimal"
        />
      </section>

      <section className="mb-7">
        <SectionTitle>Durasi</SectionTitle>
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
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink/80">
          <input
            type="checkbox"
            checked={filters.hideSeen}
            onChange={(e) => onChange({ ...filters, hideSeen: e.target.checked })}
            className="h-4 w-4 accent-[#8cc63f]"
          />
          Sembunyikan film yang sudah saya tonton
        </label>
      </section>
    </SlideOver>
  )
}
