import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { errorMessage } from '../lib/errors'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (errOrMessage: unknown) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++
      setToasts((t) => [...t.slice(-3), { id, kind, message }])
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      info: (m) => push('info', m),
      error: (e) => push('error', typeof e === 'string' ? e : errorMessage(e)),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6 print:hidden"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg shadow-slate-900/5"
          >
            {t.kind === 'success' && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
            {t.kind === 'error' && <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />}
            {t.kind === 'info' && <Info className="mt-0.5 size-4 shrink-0 text-indigo-600" />}
            <p className="flex-1 text-slate-700">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Fermer la notification"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
