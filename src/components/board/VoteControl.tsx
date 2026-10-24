import { useState } from 'react'
import { Minus, Plus, ThumbsUp, Lock } from 'lucide-react'
import { cx } from '../ui/primitives'
import { useToast } from '../../context/ToastContext'
import type { Board } from '../../hooks/useRetroBoard'
import type { Card } from '../../lib/types'

export function VoteControl({ board, card, size = 'sm' }: { board: Board; card: Card; size?: 'sm' | 'lg' }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const mine = board.myVotes.get(card.id) ?? 0
  const total = board.voteTotals?.get(card.id) ?? null
  const retro = board.retro!

  const canAdd = board.canVote && board.votesRemaining > 0 && (retro.allow_multiple_votes || mine === 0)
  const canRemove = board.canVote && mine > 0

  async function run(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const totalBadge =
    total !== null ? (
      <span
        className={cx(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
          total > 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400',
        )}
        title={`${total} vote${total > 1 ? 's' : ''} au total`}
      >
        <ThumbsUp className="size-3" />
        {total}
      </span>
    ) : retro.confidential_votes && (retro.status === 'voting' || !retro.votes_revealed) ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" title="Vote confidentiel : résultats après la clôture">
        <Lock className="size-3" />
      </span>
    ) : null

  if (!board.canVote) return totalBadge

  // Vote simple (une voix par idée) : bouton bascule.
  if (!retro.allow_multiple_votes) {
    return (
      <div className="flex items-center gap-1.5">
        {totalBadge}
        <button
          type="button"
          disabled={busy || (!canAdd && !canRemove)}
          onClick={() => run(() => (mine ? board.mutations.unvote(card.id) : board.mutations.vote(card.id)))}
          aria-pressed={mine > 0}
          aria-label={mine ? 'Retirer mon vote' : 'Voter pour cette idée'}
          title={!canAdd && !mine ? 'Plus de votes disponibles' : undefined}
          className={cx(
            'inline-flex items-center gap-1 rounded-lg font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
            size === 'lg' ? 'h-10 px-4 text-sm' : 'h-7 px-2.5 text-xs',
            mine
              ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200',
          )}
        >
          <ThumbsUp className={size === 'lg' ? 'size-4' : 'size-3.5'} />
          {mine ? 'Voté' : 'Voter'}
        </button>
      </div>
    )
  }

  // Votes multiples : compteur − / +.
  return (
    <div className="flex items-center gap-1.5">
      {totalBadge}
      <div
        className={cx(
          'inline-flex items-center rounded-lg ring-1',
          mine ? 'bg-indigo-50 ring-indigo-200' : 'bg-white ring-slate-200',
        )}
      >
        <button
          type="button"
          disabled={busy || !canRemove}
          onClick={() => run(() => board.mutations.unvote(card.id))}
          aria-label="Retirer un vote"
          className="inline-flex size-7 items-center justify-center rounded-l-lg text-slate-500 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Minus className="size-3.5" />
        </button>
        <span className={cx('min-w-5 text-center text-xs font-semibold tabular-nums', mine ? 'text-indigo-700' : 'text-slate-400')} aria-label={`${mine} de mes votes`}>
          {mine}
        </span>
        <button
          type="button"
          disabled={busy || !canAdd}
          onClick={() => run(() => board.mutations.vote(card.id))}
          aria-label="Ajouter un vote"
          className="inline-flex size-7 items-center justify-center rounded-r-lg text-slate-500 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
