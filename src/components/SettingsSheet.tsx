import { useState } from 'react'
import { KEYS, readJSON, writeJSON } from '../lib/storage'
import {
  clearPosterCache,
  getTmdbKey,
  posterCacheStats,
  retryFailedPosters,
} from '../lib/posters'
import { sfx } from '../lib/sound'
import {
  formatCode,
  generateCode,
  isValidCode,
  normalizeCode,
} from '../lib/sync'
import type { Arcade } from '../lib/useArcade'
import Sheet from './Sheet'

type Props = {
  open: boolean
  sync: Arcade['sync']
  onClose: () => void
  onResetProgress: () => void
}

const SYNC_STATUS_TEXT: Record<Arcade['sync']['status'], string> = {
  off: 'Tidak aktif — koleksi hanya tersimpan di perangkat ini',
  connecting: 'Menyambungkan…',
  synced: 'Tersambung',
  offline: 'Tidak bisa menjangkau server — perubahan tetap tersimpan lokal',
  not_configured: 'Server belum dipasangi penyimpanan bersama',
  error: 'Sinkronisasi gagal — perubahan tetap tersimpan lokal',
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="hairline-b px-5 py-5 last:border-0">
      <h3 className="t-body-sm mb-3 font-semibold text-frost">{title}</h3>
      {children}
    </section>
  )
}

export default function SettingsSheet({ open, sync, onClose, onResetProgress }: Props) {
  const [key, setKey] = useState(getTmdbKey)
  const [muted, setMuted] = useState(sfx.muted)
  const [saved, setSaved] = useState(false)
  const [stats, setStats] = useState(() => posterCacheStats())
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    if (!sync.code) return
    try {
      await navigator.clipboard.writeText(formatCode(sync.code))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard ditolak — kodenya tetap terbaca di layar */
    }
  }

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

      <Group title="Sinkron antar perangkat">
        <p className="t-body-sm font-light text-ash">
          Koleksi disimpan di browser masing-masing perangkat. Sambungkan keduanya dengan satu kode
          supaya tangkapan, watchlist, dan tanda ditonton mengikuti ke mana pun kamu buka.
        </p>

        <p className="t-caption mt-3 text-mist" role="status">
          {SYNC_STATUS_TEXT[sync.status]}
          {sync.lastSyncedAt != null && sync.status === 'synced'
            ? ` · terakhir ${new Date(sync.lastSyncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </p>

        {sync.code ? (
          <>
            <div className="mt-3 flex items-center justify-between rounded-[8px] border border-hairline bg-onyx px-3.5 py-3">
              <span
                data-sync-code={sync.code}
                className="t-subheading font-semibold tracking-[0.12em] text-frost"
              >
                {formatCode(sync.code)}
              </span>
              <button onClick={copyCode} className="pill pill--sm pill--quiet">
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <p className="t-caption mt-2 font-light text-mist">
              Masukkan kode ini di perangkat lain lewat Pengaturan.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  sfx.click()
                  sync.refresh()
                }}
                className="pill pill--sm pill--quiet"
              >
                Sinkronkan sekarang
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Putuskan sambungan? Koleksi di perangkat ini tetap ada.')) {
                    sfx.click()
                    sync.disconnect()
                  }
                }}
                className="pill pill--sm"
                style={{ background: '#2c2c2e', color: '#ff453a' }}
              >
                Putuskan
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                sfx.chime()
                sync.connect(generateCode())
              }}
              className="pill pill--filled mt-3 w-full"
            >
              Buat kode sync
            </button>
            <p className="t-caption mt-4 mb-2 font-light text-mist">
              Sudah punya kode dari perangkat lain?
            </p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
                aria-label="Masukkan kode sync dari perangkat lain"
                className="t-body-sm min-w-0 flex-1 rounded-[8px] border border-hairline bg-onyx px-3 py-2.5 font-semibold tracking-[0.12em] text-frost placeholder:font-light placeholder:tracking-normal placeholder:text-mist focus:border-apple-blue focus:outline-none"
              />
              <button
                onClick={() => {
                  const code = normalizeCode(joinCode)
                  if (!isValidCode(code)) return
                  sfx.chime()
                  sync.connect(code)
                  setJoinCode('')
                }}
                disabled={!isValidCode(normalizeCode(joinCode))}
                className="pill pill--sm pill--filled"
              >
                Sambungkan
              </button>
            </div>
          </>
        )}
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
            if (window.confirm('Hapus riwayat, watchlist, dan tanda ditonton?')) {
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
