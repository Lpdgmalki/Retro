import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, EyeOff, LayoutGrid, Maximize, MessageSquare, ThumbsUp, Trophy, X } from 'lucide-react'
import { Button, cx } from '../components/ui/primitives'
import { RetroGate } from '../components/board/RetroGate'
import { RankingList } from '../components/board/RankingDialog'
import { useAuth } from '../context/AuthContext'
import { useRetroBoard, type Board } from '../hooks/useRetroBoard'
import { CATEGORIES, STATUS_BADGE, STATUS_LABEL } from '../lib/constants'

type View = 'overview' | 'positive' | 'negative' | 'improvement' | 'action' | 'ranking'
const VIEWS: View[] = ['overview', 'positive', 'negative', 'improvement', 'action', 'ranking']

export function PresentPage() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const board = useRetroBoard(id, user?.id, isAdmin)
  return (
    <RetroGate board={board}>
      <PresentView board={board} />
    </RetroGate>
  )
}

function PresentView({ board }: { board: Board }) {
  const retro = board.retro!
  const [view, setView] = useState<View>('overview')
  const idx = VIEWS.indexOf(view)

  const go = useCallback((delta: number) => setView(VIEWS[(VIEWS.indexOf(view) + delta + VIEWS.length) % VIEWS.length]), [view])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const sorted = useMemo(() => {
    const votes = (id: string) => board.voteTotals?.get(id) ?? 0
    return [...board.cards].sort((a, b) => votes(b.id) - votes(a.id) || a.created_at.localeCompare(b.created_at))
  }, [board.cards, board.voteTotals])

  const label =
    view === 'overview' ? 'Vue d’ensemble' : view === 'ranking' ? 'Classement' : CATEGORIES.find((c) => c.id === view)!.label

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{retro.teams?.name}</p>
          <div className="flex items-center gap-3">
            <h1 className="truncate text-xl font-semibold text-slate-900">{retro.sprint_name}</h1>
            <span className={cx('rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_BADGE[retro.status])}>
              {STATUS_LABEL[retro.status]}
            </span>
          </div>
        </div>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Vues">
          {VIEWS.map((v) => {
            const cat = CATEGORIES.find((c) => c.id === v)
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {v === 'overview' && <LayoutGrid className="size-4" />}
                {v === 'ranking' && <Trophy className="size-4" />}
                {cat && <span className={cx('size-2 rounded-full', cat.dot)} />}
                {v === 'overview' ? 'Ensemble' : v === 'ranking' ? 'Classement' : cat!.short}
              </button>
            )
          })}
        </nav>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label="Plein écran (F)">
            <Maximize className="size-4" />
          </Button>
          <Link to={`/r/${retro.id}`}>
            <Button variant="secondary" size="sm">
              <X className="size-4" /> Quitter
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 lg:p-8">
        <h2 className="mb-5 text-2xl font-semibold text-slate-900 lg:hidden">{label}</h2>
        {view === 'overview' && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const list = sorted.filter((c) => c.category === cat.id)
              const Icon = cat.icon
              return (
                <section key={cat.id} className={cx('rounded-2xl border bg-white/60 p-4', cat.border)}>
                  <h3 className={cx('mb-3 flex items-center gap-2 text-lg font-semibold', cat.text)}>
                    <Icon className="size-5" /> {cat.label}
                    <span className="ml-auto text-base font-medium text-slate-400 tabular-nums">{list.length}</span>
                  </h3>
                  <ul className="space-y-2">
                    {list.map((c) => (
                      <li key={c.id} className="animate-card-in rounded-xl bg-white px-4 py-3 shadow-sm">
                        <p className="text-base leading-snug font-medium text-slate-900">{c.title}</p>
                        <CardMeta board={board} cardId={c.id} anonymous={c.is_anonymous} authorId={c.author_id} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

        {CATEGORIES.some((c) => c.id === view) && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted
              .filter((c) => c.category === view)
              .map((c) => {
                const cat = CATEGORIES.find((x) => x.id === c.category)!
                return (
                  <article key={c.id} className="animate-card-in relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
                    <span className={cx('absolute inset-y-0 left-0 w-1.5', cat.accentBar)} />
                    <h3 className="text-xl leading-snug font-semibold text-slate-900">{c.title}</h3>
                    {c.description && <p className="mt-2 text-base whitespace-pre-line text-slate-600">{c.description}</p>}
                    <CardMeta board={board} cardId={c.id} anonymous={c.is_anonymous} authorId={c.author_id} large />
                  </article>
                )
              })}
            {sorted.filter((c) => c.category === view).length === 0 && <p className="text-lg text-slate-400">Aucune carte dans cette colonne.</p>}
          </div>
        )}

        {view === 'ranking' && (
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-lg shadow-sm">
            <RankingList board={board} />
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-2.5 text-sm text-slate-500">
        <Button variant="ghost" size="sm" onClick={() => go(-1)}>
          <ChevronLeft className="size-4" /> Précédent
        </Button>
        <span>
          {label} · {idx + 1}/{VIEWS.length} <span className="hidden sm:inline">— flèches ← → pour naviguer, F pour le plein écran</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => go(1)}>
          Suivant <ChevronRight className="size-4" />
        </Button>
      </footer>
    </div>
  )
}

function CardMeta({
  board,
  cardId,
  anonymous,
  authorId,
  large,
}: {
  board: Board
  cardId: string
  anonymous: boolean
  authorId: string | null
  large?: boolean
}) {
  const votes = board.voteTotals?.get(cardId)
  const comments = board.commentCount.get(cardId) ?? 0
  return (
    <div className={cx('mt-2 flex items-center gap-3 text-slate-500', large ? 'mt-4 text-sm' : 'text-xs')}>
      <span className="inline-flex items-center gap-1">
        {anonymous ? (
          <>
            <EyeOff className="size-3.5" /> Anonyme
          </>
        ) : (
          (board.nameOf.get(authorId ?? '') ?? 'Participant')
        )}
      </span>
      {votes !== undefined && votes > 0 && (
        <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
          <ThumbsUp className="size-3.5" /> {votes}
        </span>
      )}
      {comments > 0 && (
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" /> {comments}
        </span>
      )}
    </div>
  )
}
