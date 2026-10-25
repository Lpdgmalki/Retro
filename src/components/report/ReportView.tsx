import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CalendarClock, Crown, Download, Flag, MessageSquare, Quote, Sparkles, ThumbsUp, Trophy, User, Users } from 'lucide-react'
import { Avatar, Button, cx } from '../ui/primitives'
import { useAuth } from '../../context/AuthContext'
import { ACTION_STATUS_LABEL, CATEGORY_BY_ID, PRIORITY_LABEL, PRIORITY_RANK } from '../../lib/constants'
import { formatDate, formatShortDate } from '../../lib/format'
import { memberDisplayName } from '../../lib/members'
import type { Board } from '../../hooks/useRetroBoard'
import type { ActionPriority, Card } from '../../lib/types'

const PODIUM = [
  { label: '1er', ring: 'from-amber-300 via-yellow-200 to-amber-500', text: 'text-amber-300', glow: 'shadow-[0_0_60px_-12px_rgb(251_191_36/0.55)]' },
  { label: '2e', ring: 'from-slate-200 via-white to-slate-400', text: 'text-slate-200', glow: 'shadow-[0_0_50px_-14px_rgb(203_213_225/0.45)]' },
  { label: '3e', ring: 'from-orange-300 via-amber-200 to-orange-600', text: 'text-orange-300', glow: 'shadow-[0_0_50px_-14px_rgb(251_146_60/0.45)]' },
]

const PRIORITY_DOT: Record<ActionPriority, string> = {
  high: 'bg-rose-500 shadow-[0_0_12px_rgb(244_63_94/0.8)]',
  medium: 'bg-amber-400 shadow-[0_0_12px_rgb(251_191_36/0.7)]',
  low: 'bg-slate-400',
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cx('animate-rise', className)} style={{ animationDelay: `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, kicker, title }: { icon: ReactNode; kicker: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-indigo-400 uppercase">
        {icon} {kicker}
      </p>
      <h2 className="mt-1.5 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h2>
    </div>
  )
}

/** Rapport de fin de rétrospective, affiché aux invités dès la clôture par l'administrateur. */
export function ReportView({ board }: { board: Board }) {
  const { member, isAdmin } = useAuth()
  const retro = board.retro!
  const votes = (c: Card) => board.voteTotals?.get(c.id) ?? 0

  const data = useMemo(() => {
    const byCat = (cat: Card['category']) =>
      board.cards.filter((c) => c.category === cat).sort((a, b) => votes(b) - votes(a) || a.created_at.localeCompare(b.created_at))
    const totalVotes = board.voteTotals ? [...board.voteTotals.values()].reduce((a, b) => a + b, 0) : 0
    const actions = [...board.actions].sort(
      (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
    )
    return {
      positives: byCat('positive'),
      negatives: byCat('negative'),
      improvements: byCat('improvement'),
      totalVotes,
      actions,
      comments: board.comments.filter((c) => !c.is_deleted).length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.cards, board.voteTotals, board.actions, board.comments])

  const podium = board.ranking.slice(0, 3)
  const myCards = board.ownedCardIds.size
  const myComments = board.comments.filter((c) => c.author_id === board.me?.user_id && !c.is_deleted).length
  const greeting = member ? memberDisplayName(member).split(' ')[0] : board.me?.display_name.split(' ')[0]

  const kpis = [
    { label: 'Points positifs', value: data.positives.length, cat: CATEGORY_BY_ID.positive },
    { label: 'Points à améliorer', value: data.negatives.length, cat: CATEGORY_BY_ID.negative },
    { label: 'Idées proposées', value: data.improvements.length, cat: CATEGORY_BY_ID.improvement },
    { label: 'Actions décidées', value: data.actions.length, cat: CATEGORY_BY_ID.action },
  ]

  return (
    <div className="relative overflow-hidden pb-20">
      {/* Halo et trame */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-grid print:hidden" aria-hidden />
      <div className="animate-glow pointer-events-none absolute top-[-180px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[120px] print:hidden" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <header className="pt-10 pb-12 text-center sm:pt-16">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-600/10 px-4 py-1.5 text-xs font-semibold tracking-[0.2em] text-indigo-700 uppercase">
              <Sparkles className="size-3.5" /> Rapport de rétrospective
            </span>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-6 text-sm font-medium tracking-wide text-slate-500">{retro.teams?.name}</p>
            <h1 className="text-gradient mt-2 text-4xl leading-tight font-extrabold sm:text-6xl">{retro.sprint_name}</h1>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" /> {formatDate(retro.retro_date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Crown className="size-4" /> Animée par {retro.facilitator_name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" /> {board.participants.length} participant(s)
              </span>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-7 flex justify-center -space-x-3">
              {board.participants.slice(0, 14).map((p) => (
                <Avatar key={p.user_id} name={p.display_name} seed={p.user_id} src={p.photo_url} size="md" className="size-10 ring-4 ring-canvas" />
              ))}
              {board.participants.length > 14 && (
                <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-4 ring-canvas">
                  +{board.participants.length - 14}
                </span>
              )}
            </div>
            {greeting && (
              <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
                Merci <span className="font-semibold text-slate-900">{greeting}</span> pour votre participation. Voici ce que l’équipe retient de ce
                sprint.
              </p>
            )}
            {retro.goal && <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500 italic">Objectif du sprint : {retro.goal}</p>}
          </Reveal>
        </header>

        {/* Chiffres clés */}
        <Reveal delay={320}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="card-premium relative overflow-hidden rounded-3xl border border-slate-200 p-5 sm:p-6">
                <span className={cx('absolute -top-10 -right-10 size-28 rounded-full opacity-40 blur-2xl', k.cat.dot)} aria-hidden />
                <k.cat.icon className={cx('size-5', k.cat.text)} />
                <p className="mt-4 text-4xl font-extrabold text-slate-900 tabular-nums sm:text-5xl">{k.value}</p>
                <p className="mt-1 text-sm text-slate-500">{k.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs tracking-wide text-slate-500">
            {data.totalVotes} vote(s) · {data.comments} commentaire(s) · {board.cards.length} contribution(s)
          </p>
        </Reveal>

        {/* Podium */}
        {podium.length > 0 && (
          <section className="mt-20">
            <SectionTitle icon={<Trophy className="size-3.5" />} kicker="Le choix de l’équipe" title="Les idées les plus plébiscitées" />
            <div className="grid items-end gap-4 md:grid-cols-3">
              {[1, 0, 2].map((rank, i) => {
                const entry = podium[rank]
                if (!entry) return <div key={rank} className="hidden md:block" />
                const style = PODIUM[rank]
                const cat = CATEGORY_BY_ID[entry.card.category]
                return (
                  <Reveal key={entry.card.id} delay={400 + i * 120} className={cx(rank === 0 ? 'md:order-none' : '', rank === 0 && 'order-first md:order-none')}>
                    <div className={cx('rounded-3xl bg-gradient-to-br p-px', style.ring, style.glow)}>
                      <div className={cx('rounded-[calc(1.5rem-1px)] bg-surface p-6', rank === 0 ? 'md:pb-12' : '')}>
                        <div className="flex items-center justify-between">
                          <span className={cx('text-5xl font-black', style.text)}>{style.label}</span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/15 px-3 py-1 text-sm font-bold text-indigo-700">
                            <ThumbsUp className="size-4" /> {entry.votes}
                          </span>
                        </div>
                        <p className={cx('mt-5 font-bold text-slate-900', rank === 0 ? 'text-xl' : 'text-lg')}>{entry.card.title}</p>
                        {entry.card.description && <p className="mt-2 line-clamp-3 text-sm text-slate-500">{entry.card.description}</p>}
                        <span className={cx('mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', cat.chip)}>
                          <cat.icon className="size-3" /> {cat.short}
                        </span>
                      </div>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </section>
        )}

        {/* Forces et vigilance */}
        <section className="mt-20 grid gap-6 lg:grid-cols-2">
          {[
            { kicker: 'Nos forces', title: 'Ce qui a bien fonctionné', list: data.positives, cat: CATEGORY_BY_ID.positive },
            { kicker: 'Points de vigilance', title: 'Ce qui nous a freinés', list: data.negatives, cat: CATEGORY_BY_ID.negative },
          ].map((block, bi) => (
            <Reveal key={block.kicker} delay={200 + bi * 120}>
              <div className="card-premium h-full rounded-3xl border border-slate-200 p-6 sm:p-8">
                <p className={cx('flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase', block.cat.text)}>
                  <block.cat.icon className="size-3.5" /> {block.kicker}
                </p>
                <h3 className="mt-1.5 text-xl font-bold text-slate-900">{block.title}</h3>
                {block.list.length === 0 ? (
                  <p className="mt-5 text-sm text-slate-500">Aucune contribution dans cette catégorie.</p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {block.list.slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-start gap-3">
                        <span className={cx('mt-2 size-1.5 shrink-0 rounded-full', block.cat.dot)} />
                        <p className="flex-1 text-[15px] text-slate-700">{c.title}</p>
                        {votes(c) > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500 tabular-nums">
                            <ThumbsUp className="size-3" /> {votes(c)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          ))}
        </section>

        {/* Décisions */}
        {retro.summary_notes && (
          <Reveal className="mt-20">
            <div className="relative overflow-hidden rounded-3xl border border-indigo-300/30 bg-gradient-to-br from-indigo-600/20 via-surface to-surface p-8 sm:p-12">
              <Quote className="absolute top-6 right-6 size-16 text-indigo-600/20" />
              <p className="text-xs font-semibold tracking-[0.18em] text-indigo-400 uppercase">Nos décisions</p>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed whitespace-pre-line text-slate-800 sm:text-xl">{retro.summary_notes}</p>
            </div>
          </Reveal>
        )}

        {/* Plan d'actions */}
        <section className="mt-20">
          <SectionTitle icon={<Flag className="size-3.5" />} kicker="Prochain sprint" title="Notre plan d’actions" />
          {data.actions.length === 0 ? (
            <p className="card-premium rounded-3xl border border-slate-200 p-8 text-center text-slate-500">Aucune action n’a été définie pour le moment.</p>
          ) : (
            <ol className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[19px] before:w-px before:bg-gradient-to-b before:from-indigo-500 before:to-transparent">
              {data.actions.map((a, i) => (
                <Reveal key={a.id} delay={i * 80}>
                  <li className="relative flex gap-4">
                    <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-indigo-300/50 bg-surface text-sm font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    <div className="card-premium flex-1 rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-base font-semibold text-slate-900">{a.title}</p>
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                          <span className={cx('size-2 rounded-full', PRIORITY_DOT[a.priority])} /> Priorité {PRIORITY_LABEL[a.priority].toLowerCase()}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="size-3.5" /> {a.owner_name || 'Responsable à définir'}
                        </span>
                        {a.due_date && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="size-3.5" /> {formatShortDate(a.due_date)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-slate-400">{ACTION_STATUS_LABEL[a.status]}</span>
                      </div>
                      {a.source_title && <p className="mt-2 text-xs text-slate-400">Issue de : « {a.source_title} »</p>}
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          )}
        </section>

        {/* Contribution personnelle */}
        {board.me && !isAdmin && (
          <Reveal className="mt-20">
            <div className="card-premium flex flex-col items-center gap-6 rounded-3xl border border-slate-200 p-8 text-center sm:flex-row sm:text-left">
              <Avatar name={board.me.display_name} seed={board.me.user_id} src={board.me.photo_url} size="xl" className="ring-4 ring-indigo-600/30" />
              <div className="flex-1">
                <p className="text-xs font-semibold tracking-[0.18em] text-indigo-400 uppercase">Votre contribution</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{board.me.display_name}</p>
                {board.me.job_title && <p className="text-sm text-slate-500">{board.me.job_title}</p>}
              </div>
              <div className="flex gap-6">
                {[
                  { n: myCards, l: 'carte(s)', icon: Sparkles },
                  { n: myComments, l: 'commentaire(s)', icon: MessageSquare },
                  { n: board.myVotesUsed, l: 'vote(s)', icon: ThumbsUp },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{s.n}</p>
                    <p className="text-xs text-slate-500">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        <footer className="mt-16 flex flex-col items-center gap-4 text-center print:hidden">
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => window.print()} size="lg">
              <Download className="size-4" /> Télécharger en PDF
            </Button>
            {isAdmin && (
              <Link to={`/r/${retro.id}`}>
                <Button variant="secondary" size="lg">
                  <ArrowLeft className="size-4" /> Retour au tableau
                </Button>
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-500">Rapport établi le {formatDate(retro.updated_at)} · {retro.teams?.name}</p>
        </footer>
      </div>
    </div>
  )
}
