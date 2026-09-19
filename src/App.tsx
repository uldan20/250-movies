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
    <div className="arcade-bg scanlines relative min-h-full">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-void/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
            {view === 'lobby' ? (
              <span className="font-display text-[10px] text-neon-soft neon-text">ARCADE 250</span>
            ) : (
              <button
                onClick={() => {
                  sfx.click()
                  setView('lobby')
                }}
                className="arcade-btn px-3 py-1.5 text-xs font-semibold"
              >
                ← Lobby
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span
                className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1.5 font-display text-[9px] text-gold"
                aria-label={`${arcade.coins} koin tersisa`}
              >
                ⊙ {arcade.coins}
              </span>
              <button
                onClick={() => {
                  sfx.click()
                  setPanel('filters')
                }}
                className="arcade-btn relative px-3 py-1.5 text-xs font-semibold"
              >
                Filter
                {activeFilters > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neon text-[10px] font-bold text-white">
                    {activeFilters}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  sfx.click()
                  setPanel('collection')
                }}
                className="arcade-btn px-3 py-1.5 text-xs font-semibold"
              >
                Koleksi
              </button>
              <button
                onClick={() => {
                  sfx.click()
                  setPanel('settings')
                }}
                className="arcade-btn px-3 py-1.5 text-xs font-semibold"
                aria-label="Pengaturan"
              >
                ⚙
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {view === 'lobby' ? (
            <Lobby poolSize={arcade.pool.length} onEnter={(id) => setView(id)} />
          ) : (
            <div className="px-4 py-6">
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

        <footer className="px-4 py-6 text-center text-[11px] leading-relaxed text-white/25">
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
