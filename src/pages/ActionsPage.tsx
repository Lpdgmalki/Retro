import { useMemo, useState } from 'react'
import { CheckSquare, Download, Search } from 'lucide-react'
import { Button, Card, EmptyState, Input, PageLoader, ProgressBar, Select } from '../components/ui/primitives'
import { ActionTable } from '../components/actions/ActionTable'
import { useAuth } from '../context/AuthContext'
import { useActionsList } from '../hooks/useActionsList'
import { ACTION_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_RANK } from '../lib/constants'
import { isOverdue } from '../lib/format'
import { exportActionsCsv } from './SummaryPage'
import type { ActionPriority, ActionStatus } from '../lib/types'

export function ActionsPage() {
  const { user } = useAuth()
  const { actions, loading, error, update } = useActionsList(undefined, Boolean(user))
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('all')
  const [status, setStatus] = useState<'open' | 'all' | ActionStatus>('open')
  const [priority, setPriority] = useState<'all' | ActionPriority>('all')

  const teams = useMemo(() => {
    const m = new Map<string, { name: string; total: number; done: number }>()
    for (const a of actions) {
      const name = a.retros?.teams?.name ?? 'Équipe'
      const t = m.get(a.team_id) ?? { name, total: 0, done: 0 }
      t.total++
      if (a.status === 'done') t.done++
      m.set(a.team_id, t)
    }
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [actions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return actions
      .filter(
        (a) =>
          (team === 'all' || a.team_id === team) &&
          (status === 'all' || (status === 'open' ? a.status !== 'done' : a.status === status)) &&
          (priority === 'all' || a.priority === priority) &&
          (!q || `${a.title} ${a.owner_name} ${a.source_title} ${a.retros?.sprint_name}`.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          Number(a.status === 'done') - Number(b.status === 'done') ||
          Number(isOverdue(b.due_date, b.status === 'done')) - Number(isOverdue(a.due_date, a.status === 'done')) ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
      )
  }, [actions, query, team, status, priority])

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Suivi des actions</h1>
          <p className="mt-1 text-sm text-slate-500">Les engagements pris lors des rétrospectives de vos équipes.</p>
        </div>
        <Button
          variant="secondary"
          disabled={filtered.length === 0}
          onClick={() =>
            exportActionsCsv(filtered, 'suivi', (a) => {
              const r = actions.find((x) => x.id === a.id)?.retros
              return [r?.teams?.name ?? '', r?.sprint_name ?? '']
            })
          }
        >
          <Download className="size-4" /> Exporter en CSV
        </Button>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {teams.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map(([id, t]) => (
            <Card key={id} className="p-4">
              <div className="flex items-baseline justify-between">
                <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {t.done}/{t.total} terminées
                </p>
              </div>
              <ProgressBar value={(t.done / t.total) * 100} className="mt-2" tone="bg-emerald-500" />
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une action, un responsable…" className="pl-9" aria-label="Rechercher" />
        </div>
        <Select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Équipe">
          <option value="all">Toutes les équipes</option>
          {teams.map(([id, t]) => (
            <option key={id} value={id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Statut">
          <option value="open">Non terminées</option>
          <option value="all">Tous les statuts</option>
          {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => (
            <option key={s} value={s}>
              {ACTION_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} aria-label="Priorité">
          <option value="all">Toutes priorités</option>
          {(Object.keys(PRIORITY_LABEL) as ActionPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
      </div>

      <Card className="p-4">
        {actions.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="size-8" />}
            title="Aucune action"
            description="Dans la synthèse d’une rétrospective, le facilitateur peut convertir les idées votées en actions."
          />
        ) : (
          <ActionTable
            actions={filtered}
            showRetro
            canManage={() => false}
            canUpdateStatus={() => true}
            onStatus={(a, s) => update(a.id, { status: s })}
            emptyText="Aucune action ne correspond aux filtres."
          />
        )}
      </Card>
    </div>
  )
}
