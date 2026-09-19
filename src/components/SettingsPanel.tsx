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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 font-display text-sm text-ink/70">{children}</h3>
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
    <SlideOver open={open} title="Pengaturan" onClose={onClose}>
      <section className="mb-8">
        <SectionTitle>Suara</SectionTitle>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink/80">
          <input
            type="checkbox"
            checked={!muted}
            onChange={(e) => {
              const next = !e.target.checked
              setMuted(next)
              sfx.setMuted(next)
              if (!next) sfx.click()
            }}
            className="h-4 w-4 accent-[#8cc63f]"
          />
          Efek suara arcade
        </label>
      </section>

      <section className="mb-8">
        <SectionTitle>Sumber poster</SectionTitle>
        <p className="mb-3 text-sm font-semibold leading-relaxed text-ink/60">
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
          className="w-full rounded-xl bg-ink/8 px-3.5 py-2.5 text-sm font-semibold text-ink placeholder:text-ink/35 focus:bg-ink/12 focus:outline-2 focus:outline-cab"
        />
        {saved && (
          <p className="mt-2 text-xs font-bold text-[#4c7a1e]">
            Tersimpan. Cache poster dibersihkan.
          </p>
        )}
        <p className="mt-2 text-xs font-semibold text-ink/40">
          Key disimpan hanya di browser ini (localStorage) dan tidak pernah dikirim ke mana pun
          selain TMDB.
        </p>
      </section>

      <section className="mb-8">
        <SectionTitle>Cache</SectionTitle>
        <button
          onClick={() => {
            sfx.click()
            clearPosterCache()
          }}
          className="toy-btn toy-btn--cream w-full px-4 py-3 text-sm"
        >
          Bersihkan cache poster
        </button>
      </section>

      <section>
        <SectionTitle>Zona berbahaya</SectionTitle>
        <button
          onClick={() => {
            if (window.confirm('Hapus riwayat, watchlist, tanda ditonton, dan reset koin?')) {
              sfx.fail()
              onResetProgress()
            }
          }}
          className="toy-btn w-full bg-red px-4 py-3 text-sm"
          style={{
            background: 'linear-gradient(180deg, #ef6257, #e4453a)',
            boxShadow: '0 5px 0 0 #a82f27, inset 0 2px 0 rgba(255,255,255,0.4)',
          }}
        >
          Reset semua progres
        </button>
      </section>
    </SlideOver>
  )
}
