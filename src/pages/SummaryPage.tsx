import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileText, MessageSquare, Plus, Printer, Rocket, ThumbsUp } from 'lucide-react'
import { Button, Card, EmptyState, ProgressBar, Textarea, cx } from '../components/ui/primitives'
import { ConfirmDialog } from '../components/ui/Modal'
import { RetroGate } from '../components/board/RetroGate'
import { RetroHeader } from '../components/board/RetroHeader'
import { RankingList } from '../components/board/RankingDialog'
import { CardDrawer } from '../components/board/CardDrawer'
import { ParticipantsDialog } from '../components/board/ParticipantsDialog'
import { ActionTable } from '../components/actions/ActionTable'
import { ActionFormModal } from '../components/actions/ActionFormModal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useRetroBoard, type Board } from '../hooks/useRetroBoard'
import { usePresence } from '../hooks/usePresence'
import { ACTION_STATUS_LABEL, CATEGORIES, CATEGORY_BY_ID, LIMITS, PRIORITY_LABEL, PRIORITY_RANK, STATUS_LABEL } from '../lib/constants'
import { downloadFile, slugify, toCsv } from '../lib/csv'
import { formatDate } from '../lib/format'
import type { ActionItem, Card as RetroCard } from '../lib/types'

export function SummaryPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const board = useRetroBoard(id, user?.id)
  return (
    <RetroGate board={board}>
      <SummaryView board={board} />
    </RetroGate>
  )
}

export function exportActionsCsv(actions: ActionItem[], name: string, extra?: (a: ActionItem) => string[]) {
  const headers = ['Action', 'Responsable', 'Échéance', 'Priorité', 'Statut', 'Origine', ...(extra ? ['Équipe', 'Sprint'] : [])]
  const rows = actions.map((a) => [
    a.title,
    a.owner_name,
    a.due_date ?? '',
    PRIORITY_LABEL[a.priority],
    ACTION_STATUS_LABEL[a.status],
    a.source_title,
    ...(extra ? extra(a) : []),
  ])
  downloadFile(`actions-${slugify(name)}.csv`, toCsv(headers, rows))
}

function SummaryView({ board }: { board: Board }) {
  const toast = useToast()
  const retro = board.retro!
  const online = usePresence(retro.id, board.me?.user_id, Boolean(board.me))
  const [openCard, setOpenCard] = useState<string | null>(null)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [actionModal, setActionModal] = useState<{ action?: ActionItem; source?: RetroCard } | null>(null)
  const [toDelete, setToDelete] = useState<ActionItem | null>(null)

  const counts = useMemo(() => {
    const m: Record<string, number> = { positive: 0, negative: 0, improvement: 0, action: 0 }
    for (const c of board.cards) m[c.category]++
    return m
  }, [board.cards])

  const totalVotes = board.voteTotals ? [...board.voteTotals.values()].reduce((a, b) => a + b, 0) : null

  const problems = useMemo(() => {
    return board.cards
      .filter((c) => c.category === 'negative')
      .map((c) => ({ card: c, votes: board.voteTotals?.get(c.id) ?? 0, comments: board.commentCount.get(c.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || b.comments - a.comments || a.card.created_at.localeCompare(b.card.created_at))
      .slice(0, 5)
  }, [board.cards, board.voteTotals, board.commentCount])

  const sortedActions = useMemo(
    () =>
      [...board.actions].sort(
        (a, b) =>
          Number(a.status === 'done') - Number(b.status === 'done') ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
      ),
    [board.actions],
  )
  const doneCount = board.actions.filter((a) => a.status === 'done').length

  const stats = [
    { label: 'Points positifs', value: counts.positive, cat: CATEGORY_BY_ID.positive },
    { label: 'Points négatifs', value: counts.negative, cat: CATEGORY_BY_ID.negative },
    { label: 'Idées d’amélioration', value: counts.improvement, cat: CATEGORY_BY_ID.improvement },
    { label: 'Actions retenues', value: board.actions.length, cat: CATEGORY_BY_ID.action },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 lg:px-8 print:max-w-none print:p-0">
      <div className="print:hidden">
        <RetroHeader
          board={board}
          online={online}
          section="Synthèse"
          onParticipants={() => setParticipantsOpen(true)}
          actions={
            <>
              <Link to={`/r/${retro.id}`}>
                <Button variant="secondary" size="sm">
                  <ArrowLeft className="size-4" /> Tableau
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => exportActionsCsv(board.actions, `${retro.teams?.name}-${retro.sprint_name}`)} disabled={board.actions.length === 0}>
                <Download className="size-4" /> Actions CSV
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="size-4" /> Exporter en PDF
              </Button>
            </>
          }
        />
      </div>

      {/* En-tête imprimé */}
      <div className="hidden print:block">
        <p className="text-sm text-slate-500">{retro.teams?.name}</p>
        <h1 className="text-2xl font-bold">Synthèse — {retro.sprint_name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {formatDate(retro.retro_date)} · Facilitateur : {retro.facilitator_name} · {board.participants.length} participant(s) · Statut :{' '}
          {STATUS_LABEL[retro.status]}
        </p>
        {retro.goal && <p className="mt-2 text-sm">Objectif : {retro.goal}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.cat.icon
          return (
            <Card key={s.label} className="p-4 print:shadow-none">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <span className={cx('flex size-7 items-center justify-center rounded-lg', s.cat.soft, s.cat.text)}>
                  <Icon className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{s.value}</p>
            </Card>
          )
        })}
      </div>
      <p className="-mt-3 text-xs text-slate-500">
        {board.participants.length} participant(s) · {board.cards.length} carte(s) · {board.comments.filter((c) => !c.is_deleted).length} commentaire(s)
        {totalVotes !== null && ` · ${totalVotes} vote(s)`}
      </p>

      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2 [&>*]:min-w-0">
        <Card className="p-5 print:break-inside-avoid print:shadow-none">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ThumbsUp className="size-4 text-indigo-500" /> Top 5 des idées les plus votées
          </h2>
          <div className="mt-3">
            <RankingList board={board} limit={5} onOpen={setOpenCard} />
          </div>
          {board.isFacilitator && board.ranking.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 print:hidden">
              {board.ranking.slice(0, 5).map(({ card }) =>
                board.actions.some((a) => a.source_card_id === card.id) ? null : (
                  <Button key={card.id} variant="subtle" size="sm" onClick={() => setActionModal({ source: card })}>
                    <Rocket className="size-3.5" /> {card.title.length > 28 ? card.title.slice(0, 28) + '…' : card.title}
                  </Button>
                ),
              )}
            </div>
          )}
        </Card>

        <Card className="p-5 print:break-inside-avoid print:shadow-none">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="size-2 rounded-full bg-rose-500" /> Principaux problèmes identifiés
          </h2>
          {problems.length === 0 ? (
            <EmptyState title="Aucun point négatif signalé" className="py-6" />
          ) : (
            <ol className="mt-3 space-y-2">
              {problems.map(({ card, votes, comments }) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => setOpenCard(card.id)}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{card.title}</p>
                      {card.description && <p className="line-clamp-1 text-xs text-slate-500">{card.description}</p>}
                    </div>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500 tabular-nums">
                      {board.voteTotals && (
                        <span className="inline-flex items-center gap-0.5">
                          <ThumbsUp className="size-3" /> {votes}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="size-3" /> {comments}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <DecisionsCard board={board} />

      <Card className="p-5 print:break-inside-avoid print:shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Rocket className="size-4 text-violet-500" /> Plan d’actions pour le prochain sprint
            </h2>
            {board.actions.length > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar value={(doneCount / board.actions.length) * 100} className="w-40" tone="bg-emerald-500" />
                <span className="text-xs whitespace-nowrap text-slate-500">
                  {doneCount}/{board.actions.length} terminée(s)
                </span>
              </div>
            )}
          </div>
          {board.isFacilitator && (
            <Button size="sm" onClick={() => setActionModal({})} className="print:hidden">
              <Plus className="size-4" /> Nouvelle action
            </Button>
          )}
        </div>
        <div className="mt-4">
          <ActionTable
            actions={sortedActions}
            canManage={() => board.isFacilitator}
            canUpdateStatus={() => true}
            onEdit={(a) => setActionModal({ action: a })}
            onDelete={(a) => setToDelete(a)}
            onStatus={(a, s) => board.mutations.updateAction(a.id, { status: s })}
            emptyText={
              board.isFacilitator
                ? 'Aucune action. Convertissez les idées les plus votées ou créez une action.'
                : 'Le facilitateur n’a pas encore défini d’actions.'
            }
          />
        </div>
      </Card>

      {/* Contenu détaillé pour l'export PDF */}
      <section className="hidden print:block">
        <h2 className="mt-4 mb-2 text-base font-semibold">Détail des contributions</h2>
        {CATEGORIES.map((cat) => {
          const list = board.cards.filter((c) => c.category === cat.id)
          if (list.length === 0) return null
          return (
            <div key={cat.id} className="mb-3 break-inside-avoid">
              <h3 className="text-sm font-semibold">
                {cat.label} ({list.length})
              </h3>
              <ul className="ml-4 list-disc text-sm">
                {list.map((c) => (
                  <li key={c.id}>
                    {c.title}
                    {board.voteTotals?.get(c.id) ? ` — ${board.voteTotals.get(c.id)} vote(s)` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <CardDrawer board={board} cardId={openCard} onClose={() => setOpenCard(null)} onConvert={(c) => setActionModal({ source: c })} />
      <ParticipantsDialog open={participantsOpen} onClose={() => setParticipantsOpen(false)} board={board} online={online} />
      <ActionFormModal
        open={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={actionModal?.action ? 'Modifier l’action' : actionModal?.source ? 'Convertir en action' : 'Nouvelle action'}
        initial={actionModal?.action ?? null}
        sourceCard={actionModal?.source ?? null}
        cards={board.cards}
        ownerSuggestions={board.participants.map((p) => p.display_name)}
        onSubmit={async (v) => {
          try {
            if (actionModal?.action) {
              const source = board.cards.find((c) => c.id === v.source_card_id)
              await board.mutations.updateAction(actionModal.action.id, { ...v, source_title: source?.title ?? '' })
              toast.success('Action mise à jour')
            } else {
              await board.mutations.createAction(v)
              toast.success('Action créée')
            }
          } catch (e) {
            toast.error(e)
            throw e
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer cette action ?"
        message={`« ${toDelete?.title ?? ''} » sera retirée du plan d’actions.`}
        confirmLabel="Supprimer"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          try {
            await board.mutations.deleteAction(toDelete!.id)
          } catch (e) {
            toast.error(e)
          }
          setToDelete(null)
        }}
      />
    </div>
  )
}

function DecisionsCard({ board }: { board: Board }) {
  const toast = useToast()
  const retro = board.retro!
  const [value, setValue] = useState(retro.summary_notes)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setValue(retro.summary_notes)
  }, [retro.summary_notes, editing])

  return (
    <Card className="p-5 print:break-inside-avoid print:shadow-none">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileText className="size-4 text-slate-500" /> Décisions prises par l’équipe
        </h2>
        {board.isFacilitator && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="print:hidden">
            {retro.summary_notes ? 'Modifier' : 'Rédiger'}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            autoFocus
            placeholder={'Ex. :\n- Nous adoptons une Definition of Ready dès le prochain sprint\n- Le daily passe à 9h30'}
            aria-label="Décisions de l’équipe"
          />
          <div className="flex items-center justify-between">
            <span className={cx('text-xs', value.length > LIMITS.summaryNotes ? 'text-rose-600' : 'text-slate-400')}>
              {value.length}/{LIMITS.summaryNotes}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                loading={saving}
                disabled={value.length > LIMITS.summaryNotes}
                onClick={async () => {
                  setSaving(true)
                  try {
                    await board.mutations.updateRetro({ summary_notes: value.trim() })
                    setEditing(false)
                    toast.success('Décisions enregistrées')
                  } catch (e) {
                    toast.error(e)
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      ) : retro.summary_notes ? (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-700">{retro.summary_notes}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          {board.isFacilitator
            ? 'Consignez ici les décisions clés validées en séance.'
            : 'Les décisions seront consignées par le facilitateur.'}
          {board.actions.length > 0 && ' Le plan d’actions ci-dessous récapitule les engagements pris.'}
        </p>
      )}
    </Card>
  )
}
