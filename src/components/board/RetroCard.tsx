import { memo, useState } from 'react'
import { MessageSquare, MoreHorizontal, Pencil, Trash2, EyeOff, Rocket, ArrowRightLeft, Award } from 'lucide-react'
import { Avatar, Badge, Button, cx } from '../ui/primitives'
import { Menu, type MenuItem } from '../ui/Menu'
import { ConfirmDialog } from '../ui/Modal'
import { VoteControl } from './VoteControl'
import { CardForm } from './CardForm'
import { useToast } from '../../context/ToastContext'
import { CATEGORIES, CATEGORY_BY_ID } from '../../lib/constants'
import { formatRelative, formatDateTime } from '../../lib/format'
import type { Board } from '../../hooks/useRetroBoard'
import type { Card } from '../../lib/types'

interface Props {
  board: Board
  card: Card
  rank: number | null
  onOpen: (cardId: string) => void
  onConvert: (card: Card) => void
}

function RetroCardInner({ board, card, rank, onOpen, onConvert }: Props) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const cat = CATEGORY_BY_ID[card.category]
  const retro = board.retro!
  const isOwner = board.ownedCardIds.has(card.id)
  const status = retro.status
  const canEdit = board.isFacilitator || (isOwner && status !== 'closed')
  const canDelete = board.isFacilitator || (isOwner && (status === 'draft' || status === 'open'))
  const authorName = card.is_anonymous ? 'Anonyme' : (board.nameOf.get(card.author_id ?? '') ?? 'Ancien participant')
  const comments = board.commentCount.get(card.id) ?? 0
  const linkedAction = board.actions.find((a) => a.source_card_id === card.id)

  if (editing) {
    return (
      <CardForm
        category={cat}
        initial={{ title: card.title, description: card.description, anonymous: card.is_anonymous }}
        allowAnonymous={false}
        submitLabel="Enregistrer"
        onCancel={() => setEditing(false)}
        onSubmit={async (v) => {
          try {
            await board.mutations.updateCard(card.id, { title: v.title, description: v.description })
            setEditing(false)
            toast.success('Carte mise à jour')
          } catch (e) {
            toast.error(e)
          }
        }}
      />
    )
  }

  const menuItems: MenuItem[] = []
  if (canEdit) menuItems.push({ label: 'Modifier', icon: <Pencil className="size-4" />, onSelect: () => setEditing(true) })
  if (board.isFacilitator) {
    menuItems.push({
      label: linkedAction ? 'Déjà convertie en action' : 'Convertir en action',
      icon: <Rocket className="size-4" />,
      onSelect: () => onConvert(card),
      disabled: Boolean(linkedAction),
    })
    for (const other of CATEGORIES.filter((c) => c.id !== card.category)) {
      menuItems.push({
        label: `Déplacer vers « ${other.short} »`,
        icon: <ArrowRightLeft className="size-4" />,
        onSelect: () => board.mutations.updateCard(card.id, { category: other.id }).catch(toast.error),
      })
    }
  }
  if (canDelete) menuItems.push({ label: 'Supprimer', icon: <Trash2 className="size-4" />, danger: true, onSelect: () => setConfirmDelete(true) })

  return (
    <article
      className={cx(
        'group animate-card-in relative rounded-xl border bg-white p-3.5 shadow-sm transition hover:shadow-md',
        rank !== null && rank < 3 ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200',
      )}
      aria-label={card.title}
    >
      <span className={cx('absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full', cat.accentBar)} aria-hidden />
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onOpen(card.id)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none"
        >
          {rank !== null && rank < 3 && (
            <Badge className="mb-1.5 bg-indigo-50 text-indigo-700 ring-indigo-200">
              <Award className="size-3" /> Priorité #{rank + 1}
            </Badge>
          )}
          <h3 className="text-[14px] leading-snug font-semibold break-words text-slate-900 group-hover:text-indigo-700">
            {card.title}
          </h3>
          {card.description && (
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed break-words whitespace-pre-line text-slate-600">
              {card.description}
            </p>
          )}
        </button>
        {menuItems.length > 0 && (
          <Menu
            label="Actions sur la carte"
            items={menuItems}
            trigger={(p) => (
              <Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1.5 text-slate-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 sm:aria-expanded:opacity-100" {...p}>
                <MoreHorizontal className="size-4" />
              </Button>
            )}
          />
        )}
      </div>

      {linkedAction && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
          <Rocket className="size-3" /> Action suivie
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
          {card.is_anonymous ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <EyeOff className="size-3" />
            </span>
          ) : (
            <Avatar name={authorName} seed={card.author_id ?? ''} size="xs" />
          )}
          <span className="truncate">
            {authorName}
            {isOwner && card.is_anonymous && <span className="text-slate-400"> (vous)</span>}
          </span>
          <span className="text-slate-300">·</span>
          <time dateTime={card.created_at} title={formatDateTime(card.created_at)} className="shrink-0">
            {formatRelative(card.created_at)}
          </time>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(card.id)}
            className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={`${comments} commentaire(s) — ouvrir la discussion`}
          >
            <MessageSquare className="size-3.5" />
            {comments > 0 && <span className="tabular-nums">{comments}</span>}
          </button>
          <VoteControl board={board} card={card} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette carte ?"
        message="La carte, ses commentaires et ses votes seront définitivement supprimés."
        confirmLabel="Supprimer"
        danger
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await board.mutations.deleteCard(card.id)
            toast.success('Carte supprimée')
          } catch (e) {
            toast.error(e)
          } finally {
            setDeleting(false)
            setConfirmDelete(false)
          }
        }}
      />
    </article>
  )
}

export const RetroCard = memo(RetroCardInner)
