import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { sfx } from '../lib/sound'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** Panel geser dari kanan yang dipakai filter, koleksi, dan pengaturan. */
export default function SlideOver({ open, title, onClose, children, footer }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="panel flex h-full w-full max-w-md flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-[11px] text-neon-soft neon-text">{title}</h2>
          <button
            onClick={() => {
              sfx.click()
              onClose()
            }}
            className="arcade-btn px-3 py-1.5 text-sm"
            aria-label="Tutup panel"
          >
            ✕
          </button>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-white/10 p-4">{footer}</div>}
      </aside>
    </div>
  )
}
