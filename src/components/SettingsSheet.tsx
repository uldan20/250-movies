import { useState } from 'react'
import { KEYS, readJSON, writeJSON } from '../lib/storage'
import {
  clearPosterCache,
  getTmdbKey,
  posterCacheStats,
  retryFailedPosters,
} from '../lib/posters'
import { sfx } from '../lib/sound'
import Sheet from './Sheet'

type Props = {
  open: boolean
  onClose: () => void
  onResetProgress: () => void
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="hairline-b px-5 py-5 last:border-0">
      <h3 className="t-body-sm mb-3 font-semibold text-frost">{title}</h3>
      {children}
    </section>
  )
}

export default function SettingsSheet({ open, onClose, onResetProgress }: Props) {
  const [key, setKey] = useState(getTmdbKey)
  const [muted, setMuted] = useState(sfx.muted)
  const [saved, setSaved] = useState(false)
  const [stats, setStats] = useState(() => posterCacheStats())

  function saveKey(value: string) {
    setKey(value)
    const settings = readJSON<Record<string, unknown>>(KEYS.settings, {})
    writeJSON(KEYS.settings, { ...settings, tmdbKey: value.trim() })
    clearPosterCache()
    setStats(posterCacheStats())
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <Sheet open={open} title="Pengaturan" onClose={onClose}>
      <Group title="Suara">
        <label className="t-body-sm flex cursor-pointer items-center gap-3 font-light text-ash">
          <input
            type="checkbox"
            checked={!muted}
            onChange={(e) => {
              const next = !e.target.checked
              setMuted(next)
              sfx.setMuted(next)
              if (!next) sfx.click()
            }}
            className="h-4 w-4 accent-[#0071e3]"
          />
          Efek suara
        </label>
      </Group>

      <Group title="Poster">
        <p className="t-body-sm font-light text-ash">
          Poster diambil langsung di browsermu: Wikipedia tanpa kunci, atau TMDB kalau kamu
          menempelkan API key gratis di bawah.
        </p>
        <p className="t-caption mt-3 text-mist">
          Tersimpan di cache: <strong className="text-frost">{stats.hits}</strong> poster ·{' '}
          <strong className="text-frost">{stats.misses}</strong> gagal
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              sfx.click()
              retryFailedPosters()
              setStats(posterCacheStats())
            }}
            className="pill pill--sm pill--quiet"
          >
            Coba ulang yang gagal
          </button>
          <button
            onClick={() => {
              sfx.click()
              clearPosterCache()
              setStats(posterCacheStats())
            }}
            className="pill pill--sm pill--quiet"
          >
            Bersihkan cache
          </button>
        </div>
        <input
          type="password"
          value={key}
          onChange={(e) => saveKey(e.target.value)}
          placeholder="TMDB API key (opsional)"
          autoComplete="off"
          spellCheck={false}
          className="t-body-sm mt-3 w-full rounded-[8px] border border-hairline bg-onyx px-3 py-2.5 font-light text-frost placeholder:text-mist focus:border-apple-blue focus:outline-none"
        />
        {saved && <p className="t-caption mt-2 text-signal-blue">Tersimpan. Cache dibersihkan.</p>}
        <p className="t-caption mt-2 font-light text-mist">
          Key disimpan hanya di browser ini dan tidak pernah dikirim ke mana pun selain TMDB.
        </p>
      </Group>

      <Group title="Progres">
        <button
          onClick={() => {
            if (window.confirm('Hapus riwayat, watchlist, tanda ditonton, dan reset koin?')) {
              sfx.fail()
              onResetProgress()
            }
          }}
          className="pill pill--sm w-full"
          style={{ background: '#2c2c2e', color: '#ff453a' }}
        >
          Reset semua progres
        </button>
      </Group>
    </Sheet>
  )
}
