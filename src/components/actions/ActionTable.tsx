import { Link } from 'react-router-dom'
import { CalendarClock, Link2, Pencil, Trash2 } from 'lucide-react'
import { Badge, Button, EmptyState, cx } from '../ui/primitives'
import { ActionStatusSelect } from './ActionStatusSelect'
import { PRIORITY_BADGE, PRIORITY_LABEL, ACTION_STATUS_LABEL } from '../../lib/constants'
import { formatShortDate, isOverdue } from '../../lib/format'
import type { ActionItem, ActionItemWithRetro, ActionStatus } from '../../lib/types'

type Row = ActionItem & Partial<Pick<ActionItemWithRetro, 'retros'>>

export function ActionTable({
  actions,
  canManage,
  canUpdateStatus,
  onEdit,
  onDelete,
  onStatus,
  showRetro,
  emptyText = 'Aucune action pour le moment.',
}: {
  actions: Row[]
  canManage: (a: Row) => boolean
  canUpdateStatus: (a: Row) => boolean
  onEdit?: (a: Row) => void
  onDelete?: (a: Row) => void
  onStatus: (a: Row, s: ActionStatus) => Promise<void>
  showRetro?: boolean
  emptyText?: string
}) {
  if (actions.length === 0) return <EmptyState title={emptyText} className="py-8" />

  return (
    <>
      {/* Tableau (écran large et impression) */}
      <div className="hidden overflow-x-auto md:block print:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-3 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Responsable</th>
              <th className="px-3 py-2 font-medium">Échéance</th>
              <th className="px-3 py-2 font-medium">Priorité</th>
              <th className="px-3 py-2 font-medium">Statut</th>
              <th className="px-3 py-2 font-medium">{showRetro ? 'Rétrospective' : 'Origine'}</th>
              <th className="py-2 pl-3 print:hidden" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actions.map((a) => {
              const overdue = isOverdue(a.due_date, a.status === 'done')
              return (
                <tr key={a.id} className="group align-top">
                  <td className={cx('py-3 pr-3 font-medium text-slate-800', a.status === 'done' && 'text-slate-400 line-through')}>
                    {a.title}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">{a.owner_name || <span className="text-slate-400">—</span>}</td>
                  <td className={cx('px-3 py-3 whitespace-nowrap', overdue ? 'font-medium text-rose-600' : 'text-slate-600')}>
                    {a.due_date ? formatShortDate(a.due_date) : <span className="text-slate-400">—</span>}
                    {overdue && <span className="ml-1 text-xs">(en retard)</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Badge className={PRIORITY_BADGE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <span className="print:hidden">
                      <ActionStatusSelect value={a.status} disabled={!canUpdateStatus(a)} onChange={(s) => onStatus(a, s)} />
                    </span>
                    <span className="hidden print:inline">{ACTION_STATUS_LABEL[a.status]}</span>
                  </td>
                  <td className="max-w-56 px-3 py-3 text-xs text-slate-500">
                    {showRetro && a.retros ? (
                      <Link to={`/r/${a.retros.id}/summary`} className="hover:text-indigo-600">
                        {a.retros.teams?.name} · {a.retros.sprint_name}
                      </Link>
                    ) : a.source_title ? (
                      <span className="inline-flex items-start gap-1">
                        <Link2 className="mt-0.5 size-3 shrink-0" /> <span className="line-clamp-2">{a.source_title}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap print:hidden">
                    {canManage(a) && (
                      <div className="flex justify-end gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                        {onEdit && (
                          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(a)} aria-label={`Modifier « ${a.title} »`}>
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(a)} aria-label={`Supprimer « ${a.title} »`} className="hover:text-rose-600">
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Liste (mobile) */}
      <ul className="space-y-2 md:hidden print:hidden">
        {actions.map((a) => {
          const overdue = isOverdue(a.due_date, a.status === 'done')
          return (
            <li key={a.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className={cx('text-sm font-medium text-slate-800', a.status === 'done' && 'text-slate-400 line-through')}>{a.title}</p>
                {canManage(a) && (
                  <div className="-mt-1 -mr-1 flex shrink-0">
                    {onEdit && (
                      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(a)} aria-label="Modifier">
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="icon-sm" onClick={() => onDelete(a)} aria-label="Supprimer">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <ActionStatusSelect value={a.status} disabled={!canUpdateStatus(a)} onChange={(s) => onStatus(a, s)} />
                <Badge className={PRIORITY_BADGE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                {a.owner_name && <span>{a.owner_name}</span>}
                {a.due_date && (
                  <span className={cx('inline-flex items-center gap-1', overdue && 'font-medium text-rose-600')}>
                    <CalendarClock className="size-3" /> {formatShortDate(a.due_date)}
                  </span>
                )}
              </div>
              {showRetro && a.retros && (
                <Link to={`/r/${a.retros.id}/summary`} className="mt-1.5 block text-xs text-slate-400">
                  {a.retros.teams?.name} · {a.retros.sprint_name}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
