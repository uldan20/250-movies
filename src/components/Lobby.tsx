import { sfx } from '../lib/sound'

export type MachineId = 'claw'

type Machine = {
  id: MachineId | string
  name: string
  tagline: string
  accent: string
  glyph: string
  available: boolean
}

const MACHINES: Machine[] = [
  {
    id: 'claw',
    name: 'MOVIE CATCHER',
    tagline: 'Capit kapsul film dari tumpukan. Cengkeramannya bisa lepas.',
    accent: '#ec4899',
    glyph: '🕹',
    available: true,
  },
  {
    id: 'case',
    name: 'CASE OPENING',
    tagline: 'Carousel poster melaju kencang lalu berhenti di satu pemenang.',
    accent: '#ffc53d',
    glyph: '🎁',
    available: false,
  },
  {
    id: 'gacha',
    name: 'GASHAPON',
    tagline: 'Putar kenop, kapsul menggelinding, goyang sampai pecah.',
    accent: '#22d3ee',
    glyph: '🔮',
    available: false,
  },
  {
    id: 'wheel',
    name: 'RODA PUTAR',
    tagline: '250 segmen, satu jarum, momentum dari tarikan jarimu.',
    accent: '#a855f7',
    glyph: '🎯',
    available: false,
  },
  {
    id: 'plinko',
    name: 'PLINKO',
    tagline: 'Jatuhkan bola, biarkan pin memutuskan tontonan malam ini.',
    accent: '#5eead4',
    glyph: '⚪',
    available: false,
  },
  {
    id: 'bracket',
    name: 'TURNAMEN 16',
    tagline: 'Enam belas film, delapan duel, satu juara pilihanmu.',
    accent: '#f97316',
    glyph: '🏆',
    available: false,
  },
]

type Props = {
  onEnter: (id: MachineId) => void
  poolSize: number
}

function Cabinet({ machine, onEnter }: { machine: Machine; onEnter: () => void }) {
  const { accent, available } = machine
  const Wrapper = available ? 'button' : 'div'

  return (
    <Wrapper
      {...(available
        ? {
            onClick: () => {
              sfx.coin()
              onEnter()
            },
            'aria-label': `Mainkan ${machine.name}`,
          }
        : { 'aria-disabled': true })}
      className={`group relative flex flex-col overflow-hidden rounded-2xl p-3 text-left transition ${
        available
          ? 'cabinet-frame cursor-pointer hover:-translate-y-1'
          : 'cabinet-frame opacity-55'
      }`}
      style={{ borderColor: `${accent}66` }}
    >
      {/* marquee */}
      <div
        className={`rounded-lg px-2 py-1.5 text-center ${available ? 'marquee-glow' : ''}`}
        style={{ background: `linear-gradient(90deg, ${accent}44, ${accent}18)` }}
      >
        <p className="font-display text-[8px] leading-relaxed text-white">{machine.name}</p>
      </div>

      {/* layar */}
      <div
        className="relative mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-black"
        style={{ boxShadow: `inset 0 0 40px ${accent}33` }}
      >
        <span className="float-slow text-4xl opacity-80 transition group-hover:scale-110">
          {machine.glyph}
        </span>
        {available ? (
          <span
            className="absolute bottom-2 rounded-full px-2.5 py-1 font-display text-[7px] text-white"
            style={{ background: `${accent}dd` }}
          >
            ▶ MAIN
          </span>
        ) : (
          <span className="absolute bottom-2 rounded-full bg-black/70 px-2 py-0.5 font-display text-[7px] text-white/70">
            SEGERA HADIR
          </span>
        )}
      </div>

      {/* dek kontrol */}
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-black/35 px-2 py-2">
        <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
        <span className="h-3 w-3 rounded-full bg-white/25" />
        <span className="ml-auto h-1.5 w-8 rounded-full bg-white/20" />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-white/55">{machine.tagline}</p>
    </Wrapper>
  )
}

export default function Lobby({ onEnter, poolSize }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="font-display text-xl text-neon-soft neon-text sm:text-2xl">ARCADE 250</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
          Ruang arcade berisi 250 film terbaik versi IMDb. Pilih mesin, bayar satu koin, dan biarkan
          mesin yang memilihkan tontonanmu malam ini.
        </p>
        <p className="mt-2 font-display text-[9px] text-cyan neon-text-cyan">
          {poolSize} FILM SIAP DICAPIT
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {MACHINES.map((m) => (
          <Cabinet key={m.id} machine={m} onEnter={() => onEnter('claw')} />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/30">
        Mesin lain menyusul — arsitekturnya sudah disiapkan untuk menampung semuanya.
      </p>
    </div>
  )
}
