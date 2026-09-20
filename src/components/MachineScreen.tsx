import CaseOpening from './CaseOpening'
import ClawMachine from './ClawMachine'
import Gashapon from './Gashapon'
import Plinko from './Plinko'
import Wheel from './Wheel'
import type { Movie } from '../data/types'
import { sfx } from '../lib/sound'
import { SettingsButton } from './ui'

export type MachineId = 'claw' | 'case' | 'gacha' | 'wheel' | 'plinko'

type Props = {
  machine: MachineId
  onChangeMachine: (id: MachineId) => void
  pool: Movie[]
  coins: number
  activeFilters: number
  onSpend: () => void
  onPrize: (movie: Movie, refundCoin: boolean) => void
  onMiss: () => void
  onInsertCoin: () => void
  onOpenFilters: () => void
  onOpenSettings: () => void
}

/** `short` dipakai di pemilih mesin supaya empat segmen tetap muat di ponsel. */
const META: Record<MachineId, { name: string; short: string; unit: string }> = {
  claw: { name: 'Movie Catcher', short: 'Capit', unit: 'film di kabin' },
  case: { name: 'Case Opening', short: 'Case', unit: 'film di strip' },
  gacha: { name: 'Gashapon', short: 'Gacha', unit: 'film di kubah' },
  wheel: { name: 'Roda Putar', short: 'Roda', unit: 'film diundi' },
  plinko: { name: 'Plinko', short: 'Plinko', unit: 'film diundi' },
}

const ORDER: MachineId[] = ['claw', 'case', 'gacha', 'wheel', 'plinko']

export default function MachineScreen({
  machine,
  onChangeMachine,
  pool,
  coins,
  activeFilters,
  onSpend,
  onPrize,
  onMiss,
  onInsertCoin,
  onOpenFilters,
  onOpenSettings,
}: Props) {
  const meta = META[machine]

  return (
    <div className="fade-in pb-28">
      <div className="px-5 pb-4 pt-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="t-heading font-bold text-frost">{meta.name}</h1>
            <p className="t-body-sm mt-1 font-light text-ash">
              {pool.length} {meta.unit}
              {activeFilters > 0 ? ` · ${activeFilters} filter aktif` : ''}
            </p>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <button onClick={onOpenFilters} className="pill pill--sm pill--quiet">
              Filter
            </button>
            <SettingsButton onClick={onOpenSettings} />
          </div>
        </div>

        {/* Pemilih mesin bergaya segmented control iOS. */}
        <div
          role="tablist"
          aria-label="Pilih mesin"
          className="mt-4 flex gap-1 rounded-[8px] border border-hairline bg-carbon p-1"
        >
          {ORDER.map((id) => (
            <button
              key={id}
              role="tab"
              data-machine={id}
              aria-selected={machine === id}
              onClick={() => {
                sfx.click()
                onChangeMachine(id)
              }}
              className={`t-body-sm flex-1 rounded-[6px] px-2 py-2 font-medium transition-colors ${
                machine === id ? 'bg-slate text-frost' : 'text-mist hover:text-ash'
              }`}
            >
              {META[id].short}
            </button>
          ))}
        </div>
      </div>

      {machine === 'claw' ? (
        <ClawMachine
          pool={pool}
          coins={coins}
          onSpend={onSpend}
          onPrize={(m) => onPrize(m, true)}
          onMiss={onMiss}
          onInsertCoin={onInsertCoin}
          onOpenFilters={onOpenFilters}
        />
      ) : machine === 'case' ? (
        <CaseOpening
          pool={pool}
          coins={coins}
          onSpend={onSpend}
          onPrize={(m) => onPrize(m, false)}
          onInsertCoin={onInsertCoin}
          onOpenFilters={onOpenFilters}
        />
      ) : machine === 'gacha' ? (
        <Gashapon
          pool={pool}
          coins={coins}
          onSpend={onSpend}
          onPrize={(m) => onPrize(m, false)}
          onInsertCoin={onInsertCoin}
          onOpenFilters={onOpenFilters}
        />
      ) : machine === 'wheel' ? (
        <Wheel
          pool={pool}
          coins={coins}
          onSpend={onSpend}
          onPrize={(m) => onPrize(m, false)}
          onInsertCoin={onInsertCoin}
          onOpenFilters={onOpenFilters}
        />
      ) : (
        <Plinko
          pool={pool}
          coins={coins}
          onSpend={onSpend}
          onPrize={(m) => onPrize(m, false)}
          onInsertCoin={onInsertCoin}
          onOpenFilters={onOpenFilters}
        />
      )}
    </div>
  )
}
