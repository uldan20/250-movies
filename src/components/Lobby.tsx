import { sfx } from '../lib/sound'

export type MachineId = 'claw'

type Machine = {
  id: MachineId | string
  name: string
  tagline: string
  body: string
  bodyDark: string
  marquee: string
  glyph: string
  available: boolean
}

const MACHINES: Machine[] = [
  {
    id: 'claw',
    name: 'MOVIE CATCHER',
    tagline: 'Capit bola film dari tumpukan. Cengkeramannya bisa lepas.',
    body: '#8cc63f',
    bodyDark: '#4c7a1e',
    marquee: '#1e3a6e',
    glyph: '🕹️',
    available: true,
  },
  {
    id: 'case',
    name: 'CASE OPENING',
    tagline: 'Carousel poster melaju kencang lalu berhenti di satu pemenang.',
    body: '#f0a030',
    bodyDark: '#b9641a',
    marquee: '#7a3e0d',
    glyph: '🎁',
    available: false,
  },
  {
    id: 'gacha',
    name: 'GASHAPON',
    tagline: 'Putar kenop, kapsul menggelinding, goyang sampai pecah.',
    body: '#3b82c4',
    bodyDark: '#255a8f',
    marquee: '#14345c',
    glyph: '🔮',
    available: false,
  },
  {
    id: 'wheel',
    name: 'RODA PUTAR',
    tagline: '250 segmen, satu jarum, momentum dari tarikan jarimu.',
    body: '#9b59b6',
    bodyDark: '#6f3a86',
    marquee: '#40224f',
    glyph: '🎯',
    available: false,
  },
  {
    id: 'plinko',
    name: 'PLINKO',
    tagline: 'Jatuhkan bola, biarkan pin memutuskan tontonan malam ini.',
    body: '#2fb3a8',
    bodyDark: '#1d7d75',
    marquee: '#11504b',
    glyph: '⚪',
    available: false,
  },
  {
    id: 'bracket',
    name: 'TURNAMEN 16',
    tagline: 'Enam belas film, delapan duel, satu juara pilihanmu.',
    body: '#e4453a',
    bodyDark: '#a82f27',
    marquee: '#6e1b16',
    glyph: '🏆',
    available: false,
  },
]

type Props = {
  onEnter: (id: MachineId) => void
  poolSize: number
}

function Cabinet({ machine, onEnter }: { machine: Machine; onEnter: () => void }) {
  const { available, body, bodyDark, marquee } = machine
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
      className={`group flex flex-col rounded-2xl p-2.5 text-left transition ${
        available ? 'cursor-pointer hover:-translate-y-1' : ''
      }`}
      style={{
        // Filter, bukan opacity: kabinet harus tetap pekat supaya garis tirai
        // di belakangnya tidak tembus.
        filter: available ? undefined : 'saturate(0.45) brightness(0.96)',
        background: `linear-gradient(180deg, ${body} 0%, ${bodyDark} 100%)`,
        boxShadow: `inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.12), 0 14px 26px -14px rgba(35,66,61,0.7)`,
      }}
    >
      {/* marquee */}
      <div
        className="rounded-lg px-1.5 py-1.5 text-center"
        style={{ background: marquee, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.14)' }}
      >
        <p className="marquee-text--sm font-display text-[10px] leading-tight sm:text-[11px]">
          {machine.name}
        </p>
      </div>

      {/* jendela kaca */}
      <div className="relative mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border-[3px] border-wood bg-[#3c6e66]">
        <span className={`text-3xl ${available ? 'bob' : 'opacity-70'}`}>{machine.glyph}</span>
        {/* pantulan kaca */}
        <span className="pointer-events-none absolute -left-2 top-0 h-full w-6 -skew-x-12 bg-white/10" />
        {available ? (
          <span className="absolute bottom-1.5 rounded-full bg-cream px-2.5 py-0.5 font-display text-[9px] text-ink">
            ▶ MAIN
          </span>
        ) : (
          <span className="absolute bottom-1.5 rounded-full bg-black/45 px-2 py-0.5 font-display text-[8px] text-cream/80">
            SEGERA HADIR
          </span>
        )}
      </div>

      {/* dek kontrol */}
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-cream px-2 py-1.5">
        <span className="h-3 w-3 rounded-full bg-red" />
        <span className="h-3 w-3 rounded-full bg-orange" />
        <span className="ml-auto h-1.5 w-7 rounded-full bg-ink/20" />
      </div>

      <p className="mt-2 px-0.5 text-[11px] font-semibold leading-snug text-white/85">
        {machine.tagline}
      </p>
    </Wrapper>
  )
}

export default function Lobby({ onEnter, poolSize }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-7 text-center">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Arcade 250</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-ink/60">
          Ruang arcade berisi 250 film terbaik versi IMDb. Pilih mesin, bayar satu koin, dan biarkan
          mesin yang memilihkan tontonanmu malam ini.
        </p>
        <p className="mt-3 inline-block rounded-full bg-cream px-4 py-1.5 font-display text-xs text-ink/70">
          {poolSize} film siap dicapit
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        {MACHINES.map((m) => (
          <Cabinet key={m.id} machine={m} onEnter={() => onEnter('claw')} />
        ))}
      </div>

      <p className="mt-8 text-center text-xs font-semibold text-ink/40">
        Mesin lain menyusul — arsitekturnya sudah disiapkan untuk menampung semuanya.
      </p>
    </div>
  )
}
