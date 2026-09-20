import { useEffect, useState } from 'react'
import { MOVIES_BY_ID } from '../data/movies'
import type { Movie } from '../data/types'
import { sfx } from '../lib/sound'
import PosterImage from './PosterImage'
import { Screen, SettingsButton } from './ui'

type Tab = 'history' | 'watchlist' | 'seen'

type Props = {
  history: string[]
  watchlist: string[]
  seen: string[]
  onSelectMovie: (m: Movie) => void
  onRemove: (tab: Tab, id: string) => void
  onClear: (tab: Tab) => void
  onOpenSettings: () => void
}

const EMPTY: Record<Tab, string> = {
  history: 'Belum ada film yang berhasil kamu capit.',
  watchlist: 'Watchlist masih kosong. Tambahkan dari detail film mana pun.',
  seen: 'Belum ada film yang kamu tandai sudah ditonton.',
}

const CLEAR_LABEL: Record<Tab, string> = {
  history: 'Hapus semua tangkapan',
  watchlist: 'Kosongkan watchlist',
  seen: 'Hapus semua tanda ditonton',
}

const CONFIRM: Record<Tab, string> = {
  history: 'Hapus seluruh riwayat tangkapan?',
  watchlist: 'Kosongkan seluruh watchlist?',
  seen: 'Hapus seluruh tanda sudah ditonton?',
}

export default function LibraryScreen({
  history,
  watchlist,
  seen,
  onSelectMovie,
  onRemove,
  onClear,
  onOpenSettings,
}: Props) {
  const [tab, setTab] = useState<Tab>('history')
  const [editing, setEditing] = useState(false)

  const source: Record<Tab, string[]> = {
    history: [...new Set(history)],
    watchlist,
    seen,
  }
  const ids = source[tab]
  const movies = ids.map((id) => MOVIES_BY_ID.get(id)).filter((m): m is Movie => m != null)

  // Mode edit tidak boleh tertinggal aktif di daftar yang sudah kosong.
  useEffect(() => {
    if (movies.length === 0) setEditing(false)
  }, [movies.length])

  return (
    <Screen>
      <div className="px-5 pb-4 pt-3">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="t-heading font-bold text-frost">Koleksi</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sfx.click()
                setEditing((e) => !e)
              }}
              disabled={movies.length === 0}
              className={`pill pill--sm ${editing ? 'pill--filled' : 'pill--quiet'}`}
            >
              {editing ? 'Selesai' : 'Edit'}
            </button>
            <SettingsButton onClick={onOpenSettings} />
          </div>
        </div>

        <div className="flex gap-1 rounded-[8px] border border-hairline bg-carbon p-1">
          {(
            [
              ['history', `Ditangkap (${source.history.length})`],
              ['watchlist', `Watchlist (${watchlist.length})`],
              ['seen', `Ditonton (${seen.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                sfx.click()
                setTab(key)
                setEditing(false)
              }}
              aria-pressed={tab === key}
              className={`t-body-sm flex-1 rounded-[6px] px-2 py-2 font-medium transition-colors ${
                tab === key ? 'bg-slate text-frost' : 'text-mist hover:text-ash'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {movies.length === 0 ? (
        <p className="t-body px-8 py-16 text-center font-light text-mist">{EMPTY[tab]}</p>
      ) : (
        <>
          {editing && (
            <p className="t-caption mb-3 px-5 text-mist">
              Ketuk tanda − untuk menghapus satu per satu. Koin tidak terpengaruh.
            </p>
          )}

          <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-5 sm:grid-cols-4 md:grid-cols-5">
            {movies.map((m) => (
              <div key={m.id} className="relative">
                <button
                  onClick={() => !editing && onSelectMovie(m)}
                  disabled={editing}
                  className="w-full text-left"
                  aria-label={`${m.title} (${m.year})`}
                >
                  <PosterImage
                    movie={m}
                    className={`aspect-[2/3] w-full transition-opacity ${
                      editing ? 'opacity-55' : 'hover:opacity-85'
                    }`}
                  />
                  <p className="t-body-sm mt-2 line-clamp-2 font-medium text-frost">{m.title}</p>
                </button>

                {editing && (
                  <button
                    onClick={() => {
                      sfx.click()
                      onRemove(tab, m.id)
                    }}
                    aria-label={`Hapus ${m.title} dari daftar`}
                    className="absolute -left-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#ff453a] text-[17px] leading-none text-white"
                  >
                    −
                  </button>
                )}
              </div>
            ))}
          </div>

          {editing && (
            <div className="mt-8 px-5">
              <button
                onClick={() => {
                  if (window.confirm(CONFIRM[tab])) {
                    sfx.fail()
                    onClear(tab)
                  }
                }}
                className="pill pill--sm w-full"
                style={{ background: '#2c2c2e', color: '#ff453a' }}
              >
                {CLEAR_LABEL[tab]}
              </button>
            </div>
          )}
        </>
      )}
    </Screen>
  )
}
