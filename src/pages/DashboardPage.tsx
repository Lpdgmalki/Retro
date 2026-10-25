import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckSquare, History, Plus, Radio, Sparkles } from 'lucide-react'
import { Button, Card, EmptyState, PageLoader, ProgressBar, cx } from '../components/ui/primitives'
import { RetroRow } from '../components/RetroListItemRow'
import { ActionStatusSelect } from '../components/actions/ActionStatusSelect'
import { useAuth } from '../context/AuthContext'
import { useMyRetros } from '../hooks/useMyRetros'
import { useActionsList } from '../hooks/useActionsList'
import { formatShortDate, isOverdue } from '../lib/format'
import { CATEGORIES, PRIORITY_RANK } from '../lib/constants'

export function DashboardPage() {
  const { user, displayName } = useAuth()
  const navigate = useNavigate()
  const { retros, loading, error } = useMyRetros(user?.id)
  const actionsList = useActionsList(undefined, Boolean(user))

  const active = retros.filter((r) => r.status === 'open' || r.status === 'voting' || (r.status === 'draft' && r.myRole === 'facilitator'))
  const recent = retros.slice(0, 6)
  const openActions = useMemo(
    () =>
      actionsList.actions
        .filter((a) => a.status !== 'done')
        .sort(
          (a, b) =>
            Number(isOverdue(b.due_date, false)) - Number(isOverdue(a.due_date, false)) ||
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
        ),
    [actionsList.actions],
  )
  const doneActions = actionsList.actions.filter((a) => a.status === 'done').length
  const totalActions = actionsList.actions.length
  const overdue = openActions.filter((a) => isOverdue(a.due_date, false)).length

  if (loading) return <PageLoader />

  const hello = displayName ? `Bonjour ${displayName}` : 'Bienvenue'

  if (!error && retros.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <div className="mx-auto mb-6 grid w-fit grid-cols-2 gap-1.5">
            {CATEGORIES.map((c) => (
              <span key={c.id} className={cx('flex size-11 items-center justify-center rounded-xl', c.soft, c.text)}>
                <c.icon className="size-5" />
              </span>
            ))}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{hello} sur Rétro Sprint</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Animez vos rétrospectives en équipe, en salle ou à distance : collectez les retours, votez pour les meilleures idées et
            transformez-les en actions suivies.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/admin/new">
              <Button size="lg">
                <Plus className="size-4" /> Créer ma première rétrospective
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">Vous avez reçu un lien d’invitation ? Ouvrez-le simplement pour rejoindre la session.</p>
        </div>
        <ol className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            ['1. Créez', 'Renseignez l’équipe, le sprint et le facilitateur.'],
            ['2. Partagez', 'Envoyez le lien : chacun rejoint avec un simple pseudo.'],
            ['3. Décidez', 'Votez, puis convertissez les idées en actions suivies.'],
          ].map(([t, d]) => (
            <li key={t} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">{t}</p>
              <p className="mt-1 text-sm text-slate-500">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{hello}</h1>
          <p className="mt-1 text-sm text-slate-500">Vos rétrospectives et le suivi des actions de vos équipes.</p>
        </div>
        <Link to="/admin/new">
          <Button>
            <Plus className="size-4" /> Nouvelle rétrospective
          </Button>
        </Link>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Radio className="size-3.5 text-emerald-500" /> En cours
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{active.length}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <CheckSquare className="size-3.5 text-violet-500" /> Actions ouvertes
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {openActions.length}
            {overdue > 0 && <span className="ml-2 text-sm font-medium text-rose-600">dont {overdue} en retard</span>}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Progression des actions</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{totalActions ? Math.round((doneActions / totalActions) * 100) : 0}%</p>
          <ProgressBar value={totalActions ? (doneActions / totalActions) * 100 : 0} className="mt-2" tone="bg-emerald-500" />
        </Card>
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Rétrospectives en cours
          </h2>
          <div className="grid gap-3 md:grid-cols-2 [&>*]:min-w-0">
            {active.map((r) => (
              <Link
                key={r.id}
                to={`/r/${r.id}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <p className="text-xs text-slate-500">{r.teams?.name}</p>
                <p className="mt-0.5 font-semibold text-slate-900 group-hover:text-indigo-700">{r.sprint_name}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  {r.status === 'voting' ? 'Voter maintenant' : r.status === 'draft' ? 'Préparer' : 'Contribuer'}
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5 [&>*]:min-w-0">
        <section className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <History className="size-4 text-slate-400" /> Rétrospectives récentes
            </h2>
            <Link to="/admin/retros" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Tout voir
            </Link>
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {recent.map((r) => (
                <RetroRow key={r.id} retro={r} onDuplicate={(x) => navigate(`/admin/new?from=${x.id}`)} />
              ))}
            </ul>
          </Card>
        </section>

        <section className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="size-4 text-slate-400" /> Actions à suivre
            </h2>
            <Link to="/admin/actions" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Tout voir
            </Link>
          </div>
          <Card>
            {openActions.length === 0 ? (
              <EmptyState title="Aucune action ouverte" description="Les actions décidées en rétrospective apparaîtront ici." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {openActions.slice(0, 7).map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{a.title}</p>
                      <ActionStatusSelect value={a.status} onChange={(s) => actionsList.update(a.id, { status: s })} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {a.owner_name || 'Sans responsable'}
                      {a.due_date && (
                        <span className={cx(isOverdue(a.due_date, false) && 'font-medium text-rose-600')}> · {formatShortDate(a.due_date)}</span>
                      )}
                      <span className="text-slate-400">
                        {' '}
                        · {a.retros?.teams?.name} / {a.retros?.sprint_name}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}
