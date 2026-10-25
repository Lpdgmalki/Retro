import { useMemo, useState } from 'react'
import { ChevronDown, History } from 'lucide-react'
import { Badge, ProgressBar, cx } from '../ui/primitives'
import { ActionStatusSelect } from '../actions/ActionStatusSelect'
import { useActionsList } from '../../hooks/useActionsList'
import { PRIORITY_BADGE, PRIORITY_LABEL } from '../../lib/constants'
import { formatShortDate, isOverdue } from '../../lib/format'

/** Rappel des actions décidées lors des rétrospectives précédentes de l'équipe. */
export function PreviousActionsPanel({ teamId, currentRetroId }: { teamId: string; currentRetroId: string }) {
  const { actions, loading, update } = useActionsList(teamId)
  const [open, setOpen] = useState(false)

  const previous = useMemo(() => actions.filter((a) => a.retro_id !== currentRetroId), [actions, currentRetroId])
  const done = previous.filter((a) => a.status === 'done').length
  const openItems = previous
    .filter((a) => a.status !== 'done')
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))

  if (loading || previous.length === 0) return null
  const pct = (done / previous.length) * 100

  return (
    <section className="rounded-xl border border-slate-200 bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <History className="size-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">
            Actions des sprints précédents
            <span className="ml-2 font-normal text-slate-500">
              {done}/{previous.length} terminées
              {openItems.length > 0 && ` · ${openItems.length} encore ouverte${openItems.length > 1 ? 's' : ''}`}
            </span>
          </p>
          <ProgressBar value={pct} className="mt-1.5 max-w-xs" tone="bg-emerald-500" />
        </div>
        <ChevronDown className={cx('size-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-2">
          {openItems.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">Toutes les actions précédentes sont terminées. Bravo !</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openItems.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <p className="min-w-0 flex-1 text-sm text-slate-800">{a.title}</p>
                  <span className="text-xs text-slate-500">{a.owner_name || 'Sans responsable'}</span>
                  {a.due_date && (
                    <span className={cx('text-xs', isOverdue(a.due_date, false) ? 'font-medium text-rose-600' : 'text-slate-500')}>
                      {formatShortDate(a.due_date)}
                    </span>
                  )}
                  <Badge className={PRIORITY_BADGE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                  <span className="text-xs text-slate-400">{a.retros?.sprint_name}</span>
                  <ActionStatusSelect value={a.status} onChange={(s) => update(a.id, { status: s })} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
