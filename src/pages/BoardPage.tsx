import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { BarChart3, ChevronDown, Monitor, Search, Settings, Share2, Target, Trophy, X } from 'lucide-react'
import { Button, Input, Select, cx } from '../components/ui/primitives'
import { Column } from '../components/board/Column'
import { CardDrawer } from '../components/board/CardDrawer'
import { ShareDialog } from '../components/board/ShareDialog'
import { SettingsDialog } from '../components/board/SettingsDialog'
import { ParticipantsDialog } from '../components/board/ParticipantsDialog'
import { StatusControl, StatusStepper } from '../components/board/StatusControl'
import { RankingDialog } from '../components/board/RankingDialog'
import { PreviousActionsPanel } from '../components/board/PreviousActionsPanel'
import { RetroGate, ReadOnlyBanner } from '../components/board/RetroGate'
import { RetroHeader } from '../components/board/RetroHeader'
import { ActionFormModal } from '../components/actions/ActionFormModal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useRetroBoard, type Board } from '../hooks/useRetroBoard'
import { usePresence } from '../hooks/usePresence'
import { CATEGORIES } from '../lib/constants'
import type { Card, CardCategory } from '../lib/types'

type SortKey = 'recent' | 'oldest' | 'votes' | 'comments'
type FilterKey = 'all' | 'mine' | 'voted' | 'discussed'

export function BoardPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const board = useRetroBoard(id, user?.id)
  return (
    <RetroGate board={board}>
      <BoardView board={board} />
    </RetroGate>
  )
}

function BoardView({ board }: { board: Board }) {
  const toast = useToast()
  const retro = board.retro!
  const online = usePresence(retro.id, board.me?.user_id, Boolean(board.me))
  const location = useLocation()

  const [openCard, setOpenCard] = useState<string | null>(null)
  const [convertCard, setConvertCard] = useState<Card | null>(null)
  const [dialog, setDialog] = useState<'share' | 'settings' | 'participants' | 'ranking' | null>(
    (location.state as { share?: boolean } | null)?.share ? 'share' : null,
  )
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>(retro.status === 'voting' || retro.status === 'closed' ? 'votes' : 'recent')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [mobileTab, setMobileTab] = useState<CardCategory>('positive')
  const [showGoal, setShowGoal] = useState(true)

  const rankOf = useMemo(() => new Map(board.ranking.map((r, i) => [r.card.id, i])), [board.ranking])

  const byCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = board.cards.filter((c) => {
      if (q && !`${c.title} ${c.description}`.toLowerCase().includes(q)) return false
      if (filter === 'mine' && !board.ownedCardIds.has(c.id)) return false
      if (filter === 'voted' && !board.myVotes.has(c.id)) return false
      if (filter === 'discussed' && !(board.commentCount.get(c.id) ?? 0)) return false
      return true
    })
    const votesOf = (c: Card) => board.voteTotals?.get(c.id) ?? board.myVotes.get(c.id) ?? 0
    filtered.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.created_at.localeCompare(b.created_at)
        case 'votes':
          return votesOf(b) - votesOf(a) || b.created_at.localeCompare(a.created_at)
        case 'comments':
          return (board.commentCount.get(b.id) ?? 0) - (board.commentCount.get(a.id) ?? 0)
        default:
          return b.created_at.localeCompare(a.created_at)
      }
    })
    const map = new Map<CardCategory, Card[]>(CATEGORIES.map((c) => [c.id, []]))
    for (const c of filtered) map.get(c.category)!.push(c)
    return map
  }, [board.cards, board.ownedCardIds, board.myVotes, board.commentCount, board.voteTotals, query, filter, sort])

  const totals = useMemo(() => {
    const m = new Map<CardCategory, number>(CATEGORIES.map((c) => [c.id, 0]))
    for (const c of board.cards) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return m
  }, [board.cards])

  const filtersActive = query !== '' || filter !== 'all'

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
      <RetroHeader
        board={board}
        online={online}
        onParticipants={() => setDialog('participants')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDialog('share')}>
              <Share2 className="size-4" /> Inviter
            </Button>
            <Link to={`/r/${retro.id}/present`}>
              <Button variant="secondary" size="sm" title="Mode présentation">
                <Monitor className="size-4" /> <span className="hidden sm:inline">Présenter</span>
              </Button>
            </Link>
            <Link to={`/r/${retro.id}/summary`}>
              <Button variant="secondary" size="sm">
                <BarChart3 className="size-4" /> Synthèse
              </Button>
            </Link>
            {board.isFacilitator && (
              <Button variant="secondary" size="icon" onClick={() => setDialog('settings')} aria-label="Paramètres" className="size-8">
                <Settings className="size-4" />
              </Button>
            )}
          </>
        }
      />

      <ReadOnlyBanner board={board} />

      {retro.goal && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
            onClick={() => setShowGoal((s) => !s)}
            aria-expanded={showGoal}
          >
            <Target className="size-3.5" /> Objectif du sprint
            <ChevronDown className={cx('ml-auto size-3.5 transition-transform', showGoal && 'rotate-180')} />
          </button>
          {showGoal && <p className="mt-1.5 text-sm whitespace-pre-line text-slate-700">{retro.goal}</p>}
        </div>
      )}

      {board.isFacilitator ? (
        <StatusControl board={board} />
      ) : (
        <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <StatusStepper status={retro.status} />
          {retro.status === 'draft' && <p className="text-xs text-slate-500">Le facilitateur prépare la session…</p>}
        </div>
      )}

      {retro.status === 'voting' && board.me && (
        <VoteBanner board={board} onRanking={() => setDialog('ranking')} />
      )}
      {retro.status === 'closed' && board.ranking.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <p>
            <span className="font-semibold">Vote clôturé.</span> {board.ranking.length} idée(s) ont reçu des votes.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setDialog('ranking')}>
            <Trophy className="size-4" /> Classement
          </Button>
        </div>
      )}

      <PreviousActionsPanel teamId={retro.team_id} currentRetroId={retro.id} />

      {/* Barre d'outils : recherche, filtres, tri */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une carte…"
            className="pl-9"
            aria-label="Rechercher une carte"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)} aria-label="Filtrer" className="sm:w-44">
            <option value="all">Toutes les cartes</option>
            <option value="mine">Mes cartes</option>
            <option value="voted">Mes votes</option>
            <option value="discussed">Avec commentaires</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Trier" className="sm:w-44">
            <option value="recent">Plus récentes</option>
            <option value="oldest">Plus anciennes</option>
            <option value="votes">Plus votées</option>
            <option value="comments">Plus commentées</option>
          </Select>
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            <X className="size-3.5" /> Réinitialiser
          </Button>
        )}
        <p className="text-xs text-slate-400 sm:ml-auto">{board.cards.length} carte(s) au total</p>
      </div>

      {/* Onglets mobiles */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:hidden" role="tablist" aria-label="Colonnes">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={mobileTab === c.id}
            onClick={() => setMobileTab(c.id)}
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition',
              mobileTab === c.id ? c.chip : 'bg-white text-slate-600 ring-slate-200',
            )}
          >
            <span className={cx('size-2 rounded-full', c.dot)} />
            {c.short}
            <span className="tabular-nums opacity-70">{totals.get(c.id)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
        {CATEGORIES.map((c) => (
          <Column
            key={c.id}
            board={board}
            category={c}
            cards={byCategory.get(c.id)!}
            totalInCategory={totals.get(c.id) ?? 0}
            rankOf={rankOf}
            onOpen={setOpenCard}
            onConvert={setConvertCard}
            className={cx(mobileTab !== c.id && 'hidden md:flex')}
          />
        ))}
      </div>

      <CardDrawer board={board} cardId={openCard} onClose={() => setOpenCard(null)} onConvert={setConvertCard} />
      <ShareDialog open={dialog === 'share'} onClose={() => setDialog(null)} retro={retro} teamName={retro.teams?.name ?? ''} />
      {board.isFacilitator && <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} board={board} />}
      <ParticipantsDialog open={dialog === 'participants'} onClose={() => setDialog(null)} board={board} online={online} />
      <RankingDialog open={dialog === 'ranking'} onClose={() => setDialog(null)} board={board} onOpen={setOpenCard} />
      <ActionFormModal
        open={Boolean(convertCard)}
        onClose={() => setConvertCard(null)}
        title="Convertir en action"
        sourceCard={convertCard}
        cards={board.cards}
        ownerSuggestions={board.participants.map((p) => p.display_name)}
        onSubmit={async (v) => {
          try {
            await board.mutations.createAction(v)
            toast.success('Action créée et ajoutée au suivi')
          } catch (e) {
            toast.error(e)
            throw e
          }
        }}
      />
    </div>
  )
}

function VoteBanner({ board, onRanking }: { board: Board; onRanking: () => void }) {
  const retro = board.retro!
  const remaining = board.votesRemaining
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: Math.min(retro.max_votes, 20) }).map((_, i) => (
            <span
              key={i}
              className={cx('size-2.5 rounded-full transition-colors', i < board.myVotesUsed ? 'bg-amber-500' : 'bg-white ring-1 ring-amber-300')}
            />
          ))}
        </div>
        <p className="text-sm text-amber-900" aria-live="polite">
          {remaining > 0 ? (
            <>
              Il vous reste <strong className="tabular-nums">{remaining}</strong> vote{remaining > 1 ? 's' : ''} sur {retro.max_votes}
            </>
          ) : (
            <>Vous avez utilisé tous vos votes. Retirez-en un pour le déplacer.</>
          )}
          <span className="ml-1 text-amber-700/80">
            · {retro.allow_multiple_votes ? 'plusieurs votes par idée autorisés' : 'un vote par idée'}
            {retro.confidential_votes && ' · vote confidentiel'}
          </span>
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRanking}>
        <Trophy className="size-4" /> Classement
      </Button>
    </div>
  )
}
