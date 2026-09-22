import { useCallback, useEffect, useState } from 'react'
import FilterSheet from './components/FilterSheet'
import { GAMES } from './components/GameSelector'
import HomeScreen from './components/HomeScreen'
import LibraryScreen from './components/LibraryScreen'
import MachineScreen, { type MachineId } from './components/MachineScreen'
import MovieSheet from './components/MovieSheet'
import SearchScreen from './components/SearchScreen'
import SettingsSheet from './components/SettingsSheet'
import TabBar, { type TabId } from './components/TabBar'
import { PlayFab } from './components/ui'
import type { Movie } from './data/types'
import { countActive, type Filters } from './lib/filters'
import { sfx } from './lib/sound'
import { useArcade } from './lib/useArcade'

type SheetId = 'filters' | 'settings' | null

export default function App() {
  const arcade = useArcade()
  const [tab, setTab] = useState<TabId>('home')
  const [machine, setMachine] = useState<MachineId>('claw')
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
  const machineName = GAMES.find((g) => g.id === machine)?.name ?? 'mesin'
  const libraryCount = new Set([...arcade.history.map((h) => h.id), ...arcade.watchlist]).size

  return (
    <div className="min-h-full bg-onyx">
      <main>
        {tab === 'home' && (
          <HomeScreen
            machine={machine}
            history={arcade.history.map((h) => h.id)}
            watchlist={arcade.watchlist}
            watchlistCount={arcade.watchlist.length}
            activeFilters={activeFilters}
            onPlay={(id) => {
              setMachine(id)
              setTab('machine')
            }}
            onHighlight={setMachine}
            onOpenLibrary={() => {
              sfx.click()
              setTab('library')
            }}
            onSelectMovie={setDetail}
            onApplyShelf={applyShelf}
            onOpenSearch={() => {
              sfx.click()
              setTab('search')
            }}
            onOpenFilters={() => setSheet('filters')}
            onOpenSettings={() => setSheet('settings')}
          />
        )}

        {tab === 'machine' && (
          <MachineScreen
            machine={machine}
            onChangeMachine={setMachine}
            pool={arcade.pool}
            activeFilters={activeFilters}
            onPrize={handlePrize}
            onMiss={() => undefined}
            onOpenFilters={() => setSheet('filters')}
            onOpenSettings={() => setSheet('settings')}
          />
        )}

        {tab === 'library' && (
          <LibraryScreen
            history={arcade.history.map((h) => h.id)}
            watchlist={arcade.watchlist}
            seen={arcade.seen}
            onSelectMovie={setDetail}
            onRemove={(which, id) => {
              if (which === 'history') arcade.removeCatch(id)
              else if (which === 'watchlist') arcade.removeFromWatchlist(id)
              else arcade.unmarkSeen(id)
            }}
            onClear={(which) => {
              if (which === 'history') arcade.clearCatches()
              else if (which === 'watchlist') arcade.clearWatchlist()
              else arcade.clearSeen()
            }}
            onOpenSettings={() => setSheet('settings')}
          />
        )}

        {tab === 'search' && (
          <SearchScreen onSelectMovie={setDetail} onOpenSettings={() => setSheet('settings')} />
        )}
      </main>

      <TabBar
        active={tab}
        libraryCount={libraryCount}
        onChange={(next) => {
          sfx.click()
          setTab(next)
        }}
      />

      {/* Di layar mesin tombolnya disembunyikan: pemainnya sudah ada di mesin itu. */}
      {tab !== 'machine' && (
        <PlayFab
          label={`Mainkan ${machineName}`}
          onClick={() => {
            sfx.click()
            setTab('machine')
          }}
        />
      )}

      <FilterSheet
        open={sheet === 'filters'}
        filters={arcade.filters}
        matchCount={arcade.pool.length}
        onChange={arcade.setFilters}
        onClose={() => setSheet(null)}
      />
      <SettingsSheet
        open={sheet === 'settings'}
        sync={arcade.sync}
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
          onRemoveCatch={() => {
            arcade.removeCatch(prize.id)
            setPrize(null)
          }}
          onPlayAgain={() => setPrize(null)}
          onClose={() => setPrize(null)}
        />
      ) : (
        detail && (
          <MovieSheet
            movie={detail}
            inWatchlist={arcade.watchlist.includes(detail.id)}
            isSeen={arcade.seen.includes(detail.id)}
            inHistory={arcade.history.some((h) => h.id === detail.id)}
            onToggleWatchlist={() => arcade.toggleWatchlist(detail.id)}
            onToggleSeen={() => arcade.toggleSeen(detail.id)}
            onRemoveCatch={() => arcade.removeCatch(detail.id)}
            onClose={() => setDetail(null)}
          />
        )
      )}
    </div>
  )
}
