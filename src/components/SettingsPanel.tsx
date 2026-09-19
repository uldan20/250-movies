import { useState } from 'react'
import { KEYS, readJSON, writeJSON } from '../lib/storage'
import { clearPosterCache, getTmdbKey } from '../lib/posters'
import { sfx } from '../lib/sound'
import SlideOver from './SlideOver'

type Props = {
  open: boolean
  onClose: () => void
  onResetProgress: () => void
}

export default function SettingsPanel({ open, onClose, onResetProgress }: Props) {
  const [key, setKey] = useState(getTmdbKey)
  const [muted, setMuted] = useState(sfx.muted)
  const [saved, setSaved] = useState(false)

  function saveKey(value: string) {
    setKey(value)
    const settings = readJSON<Record<string, unknown>>(KEYS.settings, {})
    writeJSON(KEYS.settings, { ...settings, tmdbKey: value.trim() })
    clearPosterCache()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <SlideOver open={open} title="PENGATURAN" onClose={onClose}>
      <section className="mb-7">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Suara</h3>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={!muted}
            onChange={(e) => {
              const next = !e.target.checked
              setMuted(next)
              sfx.setMuted(next)
              if (!next) sfx.click()
            }}
            className="h-4 w-4 accent-[#ec4899]"
          />
          Efek suara arcade
        </label>
      </section>

      <section className="mb-7">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">
          Sumber poster
        </h3>
        <p className="mb-3 text-sm leading-relaxed text-white/60">
          Tanpa pengaturan apa pun, poster diambil dari Wikipedia — gratis dan tanpa kunci. Kalau
          kamu punya API key TMDB (gratis), tempel di sini untuk poster yang lebih rapi dan lebih
          lengkap.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => saveKey(e.target.value)}
          placeholder="TMDB API key (opsional)"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon focus:outline-none"
        />
        {saved && <p className="mt-2 text-xs text-cyan">Tersimpan. Cache poster dibersihkan.</p>}
        <p className="mt-2 text-xs text-white/35">
          Key disimpan hanya di browser ini (localStorage) dan tidak pernah dikirim ke mana pun
          selain TMDB.
        </p>
      </section>

      <section className="mb-7">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Cache</h3>
        <button
          onClick={() => {
            sfx.click()
            clearPosterCache()
          }}
          className="arcade-btn w-full px-4 py-2.5 text-sm font-semibold"
        >
          Bersihkan cache poster
        </button>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">
          Zona berbahaya
        </h3>
        <button
          onClick={() => {
            if (window.confirm('Hapus riwayat, watchlist, tanda ditonton, dan reset koin?')) {
              sfx.fail()
              onResetProgress()
            }
          }}
          className="arcade-btn w-full border-red-400/40 px-4 py-2.5 text-sm font-semibold text-red-300"
        >
          Reset semua progres
        </button>
      </section>
    </SlideOver>
  )
}
