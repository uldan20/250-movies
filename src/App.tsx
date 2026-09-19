import { useCallback, useState } from 'react'
import ClawMachine from './components/ClawMachine'
import CollectionPanel from './components/CollectionPanel'
import FilterPanel from './components/FilterPanel'
import Lobby, { type MachineId } from './components/Lobby'
import PrizeReveal from './components/PrizeReveal'
import SettingsPanel from './components/SettingsPanel'
import type { Movie } from './data/types'
import { countActive } from './lib/filters'
import { sfx } from './lib/sound'
import { useArcade } from './lib/useArcade'

type View = 'lobby' | MachineId
type Panel = 'filters' | 'collection' | 'settings' | null

function HeaderButton({
  onClick,
  label,
  badge,
  ariaLabel,
}: {
  onClick: () => void
  label: string
  badge?: number
  ariaLabel?: string
}) {
  return (
    <button
      onClick={() => {
        sfx.click()
        onClick()
      }}
      aria-label={ariaLabel}
      className="toy-btn toy-btn--cream relative whitespace-nowrap px-3 py-2 text-sm sm:px-3.5"
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red text-[10px] font-bold text-cream">
          {badge}
        </span>
      )}
    </button>
  )
}

export default function App() {
  const arcade = useArcade()
  const [view, setView] = useState<View>('lobby')
  const [panel, setPanel] = useState<Panel>(null)
  const [prize, setPrize] = useState<Movie | null>(null)

  const handlePrize = useCallback(
    (movie: Movie) => {
      arcade.recordWin(movie)
      setPrize(movie)
    },
    [arcade],
  )

  const activeFilters = countActive(arcade.filters)

  return (
    <div className={`room relative min-h-full ${view === 'lobby' ? '' : 'room--stage'}`}>
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 px-3 pt-3">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5 rounded-2xl bg-cream/95 px-2.5 py-2.5 sm:gap-2 sm:px-3 shadow-[0_6px_0_-2px_rgba(35,66,61,0.12),0_14px_28px_-16px_rgba(35,66,61,0.5)] backdrop-blur">
            {view === 'lobby' ? (
              <span className="font-display text-base text-ink">Arcade 250</span>
            ) : (
              <button
                onClick={() => {
                  sfx.click()
                  setView('lobby')
                }}
                aria-label="Kembali ke lobby"
                className="toy-btn toy-btn--cream whitespace-nowrap px-3 py-2 text-sm sm:px-3.5"
              >
                ← Lobby
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span
                className="flex items-center gap-1.5 rounded-full bg-orange/20 px-3 py-2 font-display text-sm text-[#b9641a]"
                aria-label={`${arcade.coins} koin tersisa`}
              >
                <span className="h-3.5 w-3.5 rounded-full border-2 border-[#b9641a]" />
                {arcade.coins}
              </span>
              <HeaderButton
                onClick={() => setPanel('filters')}
                label="Filter"
                badge={activeFilters}
              />
              <HeaderButton onClick={() => setPanel('collection')} label="Koleksi" />
              <HeaderButton
                onClick={() => setPanel('settings')}
                label="⚙"
                ariaLabel="Pengaturan"
              />
            </div>
          </div>
        </header>

        <main className="flex-1">
          {view === 'lobby' ? (
            <Lobby poolSize={arcade.pool.length} onEnter={(id) => setView(id)} />
          ) : (
            <div className="px-4 pb-10 pt-6">
              <ClawMachine
                pool={arcade.pool}
                coins={arcade.coins}
                onSpend={arcade.spendCoin}
                onPrize={handlePrize}
                onMiss={() => undefined}
                onInsertCoin={() => arcade.addCoins(5)}
              />
            </div>
          )}
        </main>

        <footer className="relative z-10 px-6 pb-6 pt-2 text-center text-[11px] font-semibold leading-relaxed text-ink/45">
          Daftar film adalah snapshot statis IMDb Top 250 — peringkat dan rating bisa berbeda dari
          IMDb hari ini. Poster diambil dari Wikipedia atau TMDB langsung di browsermu.
        </footer>
      </div>

      <FilterPanel
        open={panel === 'filters'}
        filters={arcade.filters}
        matchCount={arcade.pool.length}
        onChange={arcade.setFilters}
        onClose={() => setPanel(null)}
      />
      <CollectionPanel
        open={panel === 'collection'}
        history={arcade.history}
        watchlist={arcade.watchlist}
        seen={arcade.seen}
        onToggleWatchlist={arcade.toggleWatchlist}
        onToggleSeen={arcade.toggleSeen}
        onClose={() => setPanel(null)}
      />
      <SettingsPanel
        open={panel === 'settings'}
        onClose={() => setPanel(null)}
        onResetProgress={arcade.resetProgress}
      />

      {prize && (
        <PrizeReveal
          movie={prize}
          inWatchlist={arcade.watchlist.includes(prize.id)}
          isSeen={arcade.seen.includes(prize.id)}
          onToggleWatchlist={() => arcade.toggleWatchlist(prize.id)}
          onToggleSeen={() => arcade.toggleSeen(prize.id)}
          onPlayAgain={() => setPrize(null)}
          onClose={() => setPrize(null)}
        />
      )}
    </div>
  )
}
