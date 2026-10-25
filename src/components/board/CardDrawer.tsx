import { EyeOff, Rocket, Users } from 'lucide-react'
import { Drawer } from '../ui/Modal'
import { Avatar, Button, cx } from '../ui/primitives'
import { VoteControl } from './VoteControl'
import { CommentThread } from './CommentThread'
import { CATEGORY_BY_ID } from '../../lib/constants'
import { formatDateTime } from '../../lib/format'
import type { Board } from '../../hooks/useRetroBoard'
import type { Card } from '../../lib/types'

export function CardDrawer({
  board,
  cardId,
  onClose,
  onConvert,
}: {
  board: Board
  cardId: string | null
  onClose: () => void
  onConvert: (card: Card) => void
}) {
  const card = board.cards.find((c) => c.id === cardId) ?? null
  if (!card) return null
  const cat = CATEGORY_BY_ID[card.category]
  const Icon = cat.icon
  const author = card.is_anonymous ? 'Anonyme' : (board.nameOf.get(card.author_id ?? '') ?? 'Ancien participant')
  const voters = board.votersByCard.get(card.id) ?? []
  const voterNames = Array.from(new Set(voters)).map((id) => {
    const n = voters.filter((v) => v === id).length
    return `${board.nameOf.get(id) ?? 'Participant'}${n > 1 ? ` ×${n}` : ''}`
  })
  const linkedAction = board.actions.find((a) => a.source_card_id === card.id)

  return (
    <Drawer
      open
      onClose={onClose}
      title={card.title}
      header={
        <div className={cx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', cat.soft, cat.text)}>
          <Icon className="size-3.5" />
          {cat.label}
        </div>
      }
    >
      <div className="space-y-5 px-5 py-4">
        <div>
          <h2 className="text-lg leading-snug font-semibold break-words text-slate-900">{card.title}</h2>
          {card.description && (
            <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-line text-slate-600">{card.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {card.is_anonymous ? (
              <span className="inline-flex items-center gap-1">
                <EyeOff className="size-3.5" /> Anonyme
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={author} seed={card.author_id ?? ''} src={board.photoOf.get(card.author_id ?? '')} size="xs" /> {author}
              </span>
            )}
            <span>·</span>
            <time dateTime={card.created_at}>{formatDateTime(card.created_at)}</time>
            {card.updated_at !== card.created_at && <span>· modifiée</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-sm">
            <p className="font-medium text-slate-800">Votes</p>
            {voterNames.length > 0 ? (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                <Users className="mt-0.5 size-3 shrink-0" />
                {voterNames.join(', ')}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500">
                {board.retro?.confidential_votes ? 'Vote confidentiel : votants masqués.' : 'Aucun vote pour le moment.'}
              </p>
            )}
          </div>
          <VoteControl board={board} card={card} size="lg" />
        </div>

        {board.isFacilitator && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3">
            <div className="text-sm">
              <p className="font-medium text-slate-800">Suivi</p>
              <p className="text-xs text-slate-500">
                {linkedAction ? `Action suivie : « ${linkedAction.title} »` : 'Transformez cette carte en action pour le prochain sprint.'}
              </p>
            </div>
            {!linkedAction && (
              <Button size="sm" variant="secondary" onClick={() => onConvert(card)}>
                <Rocket className="size-3.5" /> Convertir
              </Button>
            )}
          </div>
        )}

        <section aria-label="Commentaires">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Discussion <span className="font-normal text-slate-400">({board.commentCount.get(card.id) ?? 0})</span>
          </h3>
          <CommentThread board={board} cardId={card.id} />
        </section>
      </div>
    </Drawer>
  )
}
