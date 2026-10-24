import { useState } from 'react'
import { Check, ChevronRight, Lock, PenLine, Play, Vote } from 'lucide-react'
import { Button, cx } from '../ui/primitives'
import { ConfirmDialog } from '../ui/Modal'
import { useToast } from '../../context/ToastContext'
import { STATUS_HINT, STATUS_LABEL, STATUS_ORDER } from '../../lib/constants'
import type { Board } from '../../hooks/useRetroBoard'
import type { RetroStatus } from '../../lib/types'

const NEXT: Record<RetroStatus, { to: RetroStatus; label: string; icon: typeof Play } | null> = {
  draft: { to: 'open', label: 'Ouvrir les contributions', icon: Play },
  open: { to: 'voting', label: 'Lancer le vote', icon: Vote },
  voting: { to: 'closed', label: 'Clôturer la rétrospective', icon: Lock },
  closed: null,
}

const CONFIRM: Partial<Record<RetroStatus, string>> = {
  voting: 'Les contributions seront fermées et chacun pourra répartir ses votes.',
  closed: 'Le vote sera clôturé et les résultats définitifs affichés. Les commentaires seront fermés.',
}

export function StatusStepper({ status }: { status: RetroStatus }) {
  const idx = STATUS_ORDER.indexOf(status)
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Étapes de la rétrospective">
      {STATUS_ORDER.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium whitespace-nowrap',
              i < idx && 'text-slate-500',
              i === idx && 'bg-indigo-600 text-white',
              i > idx && 'text-slate-400',
            )}
            aria-current={i === idx ? 'step' : undefined}
          >
            {i < idx && <Check className="size-3" />}
            {STATUS_LABEL[s]}
          </span>
          {i < STATUS_ORDER.length - 1 && <ChevronRight className="size-3 text-slate-300" />}
        </li>
      ))}
    </ol>
  )
}

export function StatusControl({ board }: { board: Board }) {
  const toast = useToast()
  const retro = board.retro!
  const [pending, setPending] = useState<RetroStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const next = NEXT[retro.status]

  async function apply(to: RetroStatus) {
    setSaving(true)
    try {
      await board.mutations.updateRetro({ status: to })
      toast.success(`Statut : ${STATUS_LABEL[to]}`)
    } catch (e) {
      toast.error(e)
    } finally {
      setSaving(false)
      setPending(null)
    }
  }

  function request(to: RetroStatus) {
    if (CONFIRM[to]) setPending(to)
    else apply(to)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="hidden md:block">
          <StatusStepper status={retro.status} />
        </div>
        <p className="mt-0 text-xs text-slate-500 md:mt-1.5">
          <span className="font-medium text-slate-700 md:hidden">{STATUS_LABEL[retro.status]} — </span>
          {STATUS_HINT[retro.status]}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {retro.status === 'voting' && (
          <Button variant="secondary" size="sm" onClick={() => apply('open')} disabled={saving}>
            <PenLine className="size-3.5" /> Rouvrir les contributions
          </Button>
        )}
        {retro.status === 'closed' && (
          <Button variant="secondary" size="sm" onClick={() => apply('voting')} disabled={saving}>
            <Vote className="size-3.5" /> Rouvrir le vote
          </Button>
        )}
        {retro.status === 'open' && (
          <Button variant="secondary" size="sm" onClick={() => apply('draft')} disabled={saving}>
            Repasser en brouillon
          </Button>
        )}
        {next && (
          <Button size="sm" onClick={() => request(next.to)} loading={saving}>
            <next.icon className="size-3.5" /> {next.label}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? `Passer à « ${STATUS_LABEL[pending]} » ?` : ''}
        message={pending ? CONFIRM[pending] : ''}
        confirmLabel="Confirmer"
        loading={saving}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && apply(pending)}
      />
    </div>
  )
}
