import { useMemo, useState, type FormEvent } from 'react'
import { CornerDownRight, MessageSquare, Pencil, Reply, Trash2 } from 'lucide-react'
import { Avatar, Button, EmptyState, Textarea, cx } from '../ui/primitives'
import { ConfirmDialog } from '../ui/Modal'
import { useToast } from '../../context/ToastContext'
import { LIMITS } from '../../lib/constants'
import { formatDateTime, formatRelative } from '../../lib/format'
import type { Board } from '../../hooks/useRetroBoard'
import type { Comment } from '../../lib/types'

function CommentForm({
  placeholder,
  initial = '',
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  placeholder: string
  initial?: string
  submitLabel: string
  onSubmit: (body: string) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const [body, setBody] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const clean = body.trim()
    if (!clean) return setError('Le commentaire est vide.')
    if (clean.length > LIMITS.comment) return setError(`Maximum ${LIMITS.comment} caractères.`)
    setSaving(true)
    setError(null)
    try {
      await onSubmit(clean)
      setBody('')
    } catch {
      /* le parent affiche l'erreur */
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        autoFocus={autoFocus}
        invalid={Boolean(error)}
        aria-label={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          if (e.key === 'Escape' && onCancel) {
            e.stopPropagation()
            onCancel()
          }
        }}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" size="sm" loading={saving} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function CommentNode({
  board,
  comment,
  childrenOf,
  depth,
}: {
  board: Board
  comment: Comment
  childrenOf: Map<string, Comment[]>
  depth: number
}) {
  const toast = useToast()
  const [mode, setMode] = useState<'view' | 'edit' | 'reply'>('view')
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const replies = childrenOf.get(comment.id) ?? []
  const author = board.nameOf.get(comment.author_id ?? '') ?? 'Ancien participant'
  const mine = comment.author_id === board.me?.user_id
  const edited = comment.updated_at !== comment.created_at && !comment.is_deleted
  const canEdit = mine && board.canDiscuss && !comment.is_deleted
  const canDelete = !comment.is_deleted && ((mine && board.canDiscuss) || board.isFacilitator)

  return (
    <li className={cx(depth > 0 && 'border-l-2 border-slate-100 pl-3')}>
      <div className="group py-2">
        <div className="flex items-center gap-2 text-xs">
          {comment.is_deleted ? (
            <span className="size-5 rounded-full bg-slate-100" />
          ) : (
            <Avatar name={author} seed={comment.author_id ?? ''} size="xs" />
          )}
          <span className="font-medium text-slate-800">{comment.is_deleted ? '—' : author}</span>
          {mine && !comment.is_deleted && <span className="text-slate-400">(vous)</span>}
          <time className="text-slate-400" dateTime={comment.created_at} title={formatDateTime(comment.created_at)}>
            {formatRelative(comment.created_at)}
          </time>
          {edited && <span className="text-slate-400" title={`Modifié ${formatDateTime(comment.updated_at)}`}>· modifié</span>}
        </div>

        {mode === 'edit' ? (
          <div className="mt-2">
            <CommentForm
              initial={comment.body}
              placeholder="Modifier le commentaire"
              submitLabel="Enregistrer"
              autoFocus
              onCancel={() => setMode('view')}
              onSubmit={async (body) => {
                try {
                  await board.mutations.updateComment(comment.id, body)
                  setMode('view')
                } catch (e) {
                  toast.error(e)
                  throw e
                }
              }}
            />
          </div>
        ) : (
          <p
            className={cx(
              'mt-1 pl-7 text-sm leading-relaxed break-words whitespace-pre-line',
              comment.is_deleted ? 'text-slate-400 italic' : 'text-slate-700',
            )}
          >
            {comment.is_deleted ? 'Commentaire supprimé' : comment.body}
          </p>
        )}

        {mode === 'view' && !comment.is_deleted && (
          <div className="mt-1 flex gap-1 pl-5">
            {board.canDiscuss && (
              <button
                type="button"
                onClick={() => setMode('reply')}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Reply className="size-3" /> Répondre
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Pencil className="size-3" /> Modifier
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="size-3" /> Supprimer
              </button>
            )}
          </div>
        )}

        {mode === 'reply' && (
          <div className="mt-2 flex gap-2 pl-5">
            <CornerDownRight className="mt-2 size-4 shrink-0 text-slate-300" />
            <div className="flex-1">
              <CommentForm
                placeholder={`Répondre à ${author}…`}
                submitLabel="Répondre"
                autoFocus
                onCancel={() => setMode('view')}
                onSubmit={async (body) => {
                  try {
                    await board.mutations.addComment(comment.card_id, body, comment.id)
                    setMode('view')
                  } catch (e) {
                    toast.error(e)
                    throw e
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {replies.length > 0 && (
        <ul className={cx(depth < 3 ? 'ml-3' : 'ml-0')}>
          {replies.map((r) => (
            <CommentNode key={r.id} board={board} comment={r} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirm}
        title="Supprimer ce commentaire ?"
        message={replies.length ? 'Le commentaire sera masqué ; les réponses restent visibles.' : 'Cette action est définitive.'}
        confirmLabel="Supprimer"
        danger
        loading={deleting}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await board.mutations.deleteComment(comment.id)
          } catch (e) {
            toast.error(e)
          } finally {
            setDeleting(false)
            setConfirm(false)
          }
        }}
      />
    </li>
  )
}

export function CommentThread({ board, cardId }: { board: Board; cardId: string }) {
  const toast = useToast()
  const { roots, childrenOf } = useMemo(() => {
    const list = board.comments
      .filter((c) => c.card_id === cardId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    const childrenOf = new Map<string, Comment[]>()
    const roots: Comment[] = []
    for (const c of list) {
      if (c.parent_id) {
        const arr = childrenOf.get(c.parent_id) ?? []
        arr.push(c)
        childrenOf.set(c.parent_id, arr)
      } else roots.push(c)
    }
    return { roots, childrenOf }
  }, [board.comments, cardId])

  return (
    <div>
      {roots.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-7" />}
          title="Aucun commentaire"
          description={board.canDiscuss ? 'Apportez une précision ou proposez une solution.' : undefined}
          className="py-6"
        />
      ) : (
        <ul className="divide-y divide-slate-50">
          {roots.map((c) => (
            <CommentNode key={c.id} board={board} comment={c} childrenOf={childrenOf} depth={0} />
          ))}
        </ul>
      )}
      {board.canDiscuss ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <CommentForm
            placeholder="Ajouter un commentaire…"
            submitLabel="Commenter"
            onSubmit={async (body) => {
              try {
                await board.mutations.addComment(cardId, body, null)
              } catch (e) {
                toast.error(e)
                throw e
              }
            }}
          />
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Les commentaires sont fermés pour cette rétrospective.
        </p>
      )}
    </div>
  )
}
