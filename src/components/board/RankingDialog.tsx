import { Lock, Trophy } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { EmptyState, cx } from '../ui/primitives'
import { CATEGORY_BY_ID } from '../../lib/constants'
import type { Board } from '../../hooks/useRetroBoard'

export function RankingList({ board, limit, onOpen }: { board: Board; limit?: number; onOpen?: (id: string) => void }) {
  if (!board.voteTotals) {
    return (
      <EmptyState
        icon={<Lock className="size-7" />}
        title="Résultats masqués"
        description="Vote confidentiel : le classement sera visible dès la clôture du vote."
      />
    )
  }
  const rows = limit ? board.ranking.slice(0, limit) : board.ranking
  if (rows.length === 0) {
    return <EmptyState icon={<Trophy className="size-7" />} title="Aucun vote pour le moment" />
  }
  const max = rows[0].votes
  return (
    <ol className="space-y-2">
      {rows.map(({ card, votes }, i) => {
        const cat = CATEGORY_BY_ID[card.category]
        return (
          <li key={card.id}>
            <button
              type="button"
              disabled={!onOpen}
              onClick={() => onOpen?.(card.id)}
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:hover:bg-transparent"
            >
              <span
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  i < 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cx('size-2 shrink-0 rounded-full', cat.dot)} title={cat.label} />
                  <p className="truncate text-sm font-medium text-slate-800 group-hover:text-indigo-700">{card.title}</p>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${(votes / max) * 100}%` }} />
                </div>
              </div>
              <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-700">
                {votes} <span className="text-xs font-normal text-slate-400">vote{votes > 1 ? 's' : ''}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function RankingDialog({ open, onClose, board, onOpen }: { open: boolean; onClose: () => void; board: Board; onOpen: (id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Classement des idées" description="Mis à jour en temps réel. Les 3 premières sont prioritaires.">
      <RankingList
        board={board}
        onOpen={(id) => {
          onClose()
          onOpen(id)
        }}
      />
    </Modal>
  )
}
