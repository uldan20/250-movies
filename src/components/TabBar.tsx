export type TabId = 'home' | 'machine' | 'library' | 'search'

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
  libraryCount: number
}

/** Ikon garis tipis 1.5px, sesuai bahasa ikonografi pada DESIGN.md. */
const ICONS: Record<TabId, JSX.Element> = {
  home: (
    <path d="M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  ),
  machine: (
    <>
      <path d="M12 3v7" />
      <circle cx="12" cy="11.5" r="2.2" />
      <path d="M6.5 21h11l-1.2-5.5H7.7z" />
    </>
  ),
  library: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1" />
      <rect x="10.5" y="4" width="5" height="16" rx="1" />
      <path d="M17.6 5.2 21 19.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
}

const LABELS: Record<TabId, string> = {
  home: 'Beranda',
  machine: 'Mesin',
  library: 'Koleksi',
  search: 'Cari',
}

const ORDER: TabId[] = ['home', 'machine', 'library', 'search']

export default function TabBar({ active, onChange, libraryCount }: Props) {
  return (
    <nav className="tabbar" aria-label="Navigasi utama">
      {ORDER.map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
          aria-label={LABELS[id]}
        >
          <span className="relative">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[id]}
            </svg>
            {id === 'library' && libraryCount > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-apple-blue px-1 text-[10px] font-semibold text-white">
                {libraryCount > 99 ? '99+' : libraryCount}
              </span>
            )}
          </span>
          <span className="t-caption font-medium">{LABELS[id]}</span>
        </button>
      ))}
    </nav>
  )
}
