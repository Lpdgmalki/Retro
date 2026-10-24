import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './primitives'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** Menu déroulant accessible (clavier + clic extérieur). */
export function Menu({
  trigger,
  items,
  align = 'right',
  label,
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; 'aria-label': string }) => ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
  label: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
        const idx = els.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'ArrowDown' ? (idx + 1) % els.length : (idx - 1 + els.length) % els.length
        els[next]?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    listRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-label': label })}
      {open && (
        <div
          ref={listRef}
          role="menu"
          className={cx(
            'animate-pop-in absolute z-30 mt-1 min-w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cx(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm focus:outline-none disabled:opacity-40',
                item.danger
                  ? 'text-rose-600 hover:bg-rose-50 focus:bg-rose-50'
                  : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100',
              )}
            >
              {item.icon && <span className="text-current opacity-70">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
