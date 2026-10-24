import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { History, Plus, Search } from 'lucide-react'
import { Button, Card, EmptyState, Input, PageLoader, Select } from '../components/ui/primitives'
import { RetroRow } from '../components/RetroListItemRow'
import { useAuth } from '../context/AuthContext'
import { useMyRetros } from '../hooks/useMyRetros'
import { STATUS_LABEL, STATUS_ORDER } from '../lib/constants'
import type { RetroStatus } from '../lib/types'

export function RetroListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { retros, teams, loading, error } = useMyRetros(user?.id)
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('all')
  const [status, setStatus] = useState<'all' | RetroStatus>('all')
  const [sort, setSort] = useState<'date' | 'created' | 'name'>('date')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = retros.filter(
      (r) =>
        (team === 'all' || r.team_id === team) &&
        (status === 'all' || r.status === status) &&
        (!q || `${r.sprint_name} ${r.teams?.name} ${r.facilitator_name} ${r.goal}`.toLowerCase().includes(q)),
    )
    return list.sort((a, b) => {
      if (sort === 'name') return a.sprint_name.localeCompare(b.sprint_name, 'fr', { numeric: true })
      if (sort === 'created') return b.created_at.localeCompare(a.created_at)
      return b.retro_date.localeCompare(a.retro_date) || b.created_at.localeCompare(a.created_at)
    })
  }, [retros, query, team, status, sort])

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Rétrospectives</h1>
          <p className="mt-1 text-sm text-slate-500">Historique des sessions de vos équipes.</p>
        </div>
        <Link to="/new">
          <Button>
            <Plus className="size-4" /> <span className="hidden sm:inline">Nouvelle</span>
          </Button>
        </Link>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un sprint, une équipe…" className="pl-9" aria-label="Rechercher" />
        </div>
        <Select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Équipe">
          <option value="all">Toutes les équipes</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | RetroStatus)} aria-label="Statut">
          <option value="all">Tous les statuts</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier">
          <option value="date">Date de rétro</option>
          <option value="created">Date de création</option>
          <option value="name">Nom du sprint</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<History className="size-8" />}
            title={retros.length ? 'Aucun résultat' : 'Aucune rétrospective'}
            description={retros.length ? 'Modifiez la recherche ou les filtres.' : 'Créez une rétrospective ou rejoignez-en une via un lien.'}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <RetroRow key={r.id} retro={r} onDuplicate={(x) => navigate(`/new?from=${x.id}`)} />
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-slate-400">{filtered.length} rétrospective(s)</p>
    </div>
  )
}
