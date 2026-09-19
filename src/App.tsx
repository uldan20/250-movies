import { useCallback, useEffect, useState } from 'react'
import ClawMachine from './components/ClawMachine'
import FilterSheet from './components/FilterSheet'
import HomeScreen from './components/HomeScreen'
import LibraryScreen from './components/LibraryScreen'
import MovieSheet from './components/MovieSheet'
import SearchScreen from './components/SearchScreen'
import SettingsSheet from './components/SettingsSheet'
import TabBar, { type TabId } from './components/TabBar'
import type { Movie } from './data/types'
import { countActive, type Filters } from './lib/filters'
import { sfx } from './lib/sound'
import { useArcade } from './lib/useArcade'

type SheetId = 'filters' | 'settings' | null

export default function App() {
  const arcade = useArcade()
  const [tab, setTab] = useState<TabId>('home')
  const [sheet, setSheet] = useState<SheetId>(null)
  const [detail, setDetail] = useState<Movie | null>(null)
  const [prize, setPrize] = useState<Movie | null>(null)

  // Tiap tab dimulai dari atas, seperti perpindahan tab di iOS.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  const handlePrize = useCallback(
    (movie: Movie) => {
      arcade.recordWin(movie)
      setPrize(movie)
    },
    [arcade],
  )

  const applyShelf = useCallback(
    (filter: Filters) => {
      sfx.click()
      arcade.setFilters(filter)
      setTab('machine')
    },
    [arcade],
  )

  const activeFilters = countActive(arcade.filters)
  const libraryCount = new Set([...arcade.history.map((h) => h.id), ...arcade.watchlist]).size

  return (
    <div className="min-h-full bg-onyx">
      <main>
        {tab === 'home' && (
          <HomeScreen
            history={arcade.history.map((h) => h.id)}
            watchlist={arcade.watchlist}
            coins={arcade.coins}
            onPlay={() => setTab('machine')}
            onSelectMovie={setDetail}
            onApplyShelf={applyShelf}
            onOpenSettings={() => setSheet('settings')}
          />
        )}

        {tab === 'machine' && (
          <ClawMachine
            pool={arcade.pool}
            coins={arcade.coins}
            activeFilters={activeFilters}
            onSpend={arcade.spendCoin}
            onPrize={handlePrize}
            onMiss={() => undefined}
            onInsertCoin={() => arcade.addCoins(5)}
            onOpenFilters={() => setSheet('filters')}
          />
        )}

        {tab === 'library' && (
          <LibraryScreen
            history={arcade.history.map((h) => h.id)}
            watchlist={arcade.watchlist}
            seen={arcade.seen}
            onSelectMovie={setDetail}
          />
        )}

        {tab === 'search' && <SearchScreen onSelectMovie={setDetail} />}
      </main>

      <TabBar
        active={tab}
        libraryCount={libraryCount}
        onChange={(next) => {
          sfx.click()
          setTab(next)
        }}
      />

      <FilterSheet
        open={sheet === 'filters'}
        filters={arcade.filters}
        matchCount={arcade.pool.length}
        onChange={arcade.setFilters}
        onClose={() => setSheet(null)}
      />
      <SettingsSheet
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        onResetProgress={arcade.resetProgress}
      />

      {/* Hadiah selalu menang atas lembar detail biasa. */}
      {prize ? (
        <MovieSheet
          movie={prize}
          prize
          inWatchlist={arcade.watchlist.includes(prize.id)}
          isSeen={arcade.seen.includes(prize.id)}
          onToggleWatchlist={() => arcade.toggleWatchlist(prize.id)}
          onToggleSeen={() => arcade.toggleSeen(prize.id)}
          onPlayAgain={() => setPrize(null)}
          onClose={() => setPrize(null)}
        />
      ) : (
        detail && (
          <MovieSheet
            movie={detail}
            inWatchlist={arcade.watchlist.includes(detail.id)}
            isSeen={arcade.seen.includes(detail.id)}
            onToggleWatchlist={() => arcade.toggleWatchlist(detail.id)}
            onToggleSeen={() => arcade.toggleSeen(detail.id)}
            onClose={() => setDetail(null)}
          />
        )
      )}
    </div>
  )
}
