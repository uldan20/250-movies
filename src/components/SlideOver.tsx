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
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/45 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-cream shadow-[-18px_0_40px_-20px_rgba(35,66,61,0.7)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between border-b-2 border-ink/10 px-5 py-4">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <button
            onClick={() => {
              sfx.click()
              onClose()
            }}
            className="toy-btn toy-btn--cream h-10 w-10 text-base"
            aria-label="Tutup panel"
          >
            ✕
          </button>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t-2 border-ink/10 p-4">{footer}</div>}
      </aside>
    </div>
  )
}
