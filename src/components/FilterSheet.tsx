import { ALL_DECADES, ALL_GENRES } from '../data/movies'
import { DEFAULT_FILTERS, type Filters } from '../lib/filters'
import { sfx } from '../lib/sound'
import Sheet from './Sheet'

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
      className={`pill pill--sm ${active ? 'pill--filled' : 'pill--quiet'}`}
    >
      {children}
    </button>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="hairline-b px-5 py-5 last:border-0">
      <h3 className="t-body-sm mb-3 font-semibold text-frost">{title}</h3>
      {children}
    </section>
  )
}

export default function FilterSheet({ open, filters, matchCount, onChange, onClose }: Props) {
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
    <Sheet
      open={open}
      title="Filter mesin"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="t-body-sm font-light text-ash">
            <strong className="font-semibold text-frost">{matchCount}</strong> film masuk kabin
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                sfx.click()
                onChange(DEFAULT_FILTERS)
              }}
              className="pill pill--sm pill--quiet"
            >
              Reset
            </button>
            <button onClick={onClose} className="pill pill--sm pill--filled">
              Selesai
            </button>
          </div>
        </div>
      }
    >
      {matchCount === 0 && (
        <p className="t-body-sm m-5 rounded-[8px] border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 px-4 py-3 font-light text-[#ff9f0a]">
          Tidak ada film yang cocok. Longgarkan filternya supaya kabin bisa diisi.
        </p>
      )}

      <Group title="Genre">
        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map((g) => (
            <Chip key={g} active={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Dekade">
        <div className="flex flex-wrap gap-2">
          {ALL_DECADES.map((d) => (
            <Chip key={d} active={filters.decades.includes(d)} onClick={() => toggleDecade(d)}>
              {d}s
            </Chip>
          ))}
        </div>
      </Group>

      <Group title={`Rating minimal — ${filters.minRating.toFixed(1)}`}>
        <input
          type="range"
          min={0}
          max={9}
          step={0.1}
          value={filters.minRating}
          onChange={(e) => onChange({ ...filters, minRating: Number(e.target.value) })}
          className="w-full accent-[#0071e3]"
          aria-label="Rating IMDb minimal"
        />
      </Group>

      <Group title="Durasi">
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
      </Group>

      <Group title="Sudah ditonton">
        <label className="t-body-sm flex cursor-pointer items-center gap-3 font-light text-ash">
          <input
            type="checkbox"
            checked={filters.hideSeen}
            onChange={(e) => onChange({ ...filters, hideSeen: e.target.checked })}
            className="h-4 w-4 accent-[#0071e3]"
          />
          Sembunyikan film yang sudah saya tonton
        </label>
      </Group>
    </Sheet>
  )
}
