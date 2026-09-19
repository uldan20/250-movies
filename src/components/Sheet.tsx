import type { ReactNode } from 'react'
import { useEffect } from 'react'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** Lembar modal terpusat dengan permukaan gelap dan garis rambut, tanpa shadow. */
export default function Sheet({ open, title, onClose, children, footer }: Props) {
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="sheet-up flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[14px] border border-hairline bg-carbon sm:rounded-[14px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="hairline-b flex items-center justify-between px-5 py-3.5">
          <h2 className="t-subheading font-semibold text-frost">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate text-ash transition-colors hover:text-frost"
          >
            ✕
          </button>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="hairline-t p-4">{footer}</div>}
      </div>
    </div>
  )
}
