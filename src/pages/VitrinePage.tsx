import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, Crown, Lock, Users } from 'lucide-react'
import { Badge, Button, EmptyState, Spinner } from '../components/ui/primitives'
import { Landing } from '../components/landing/Landing'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { STATUS_BADGE, STATUS_LABEL } from '../lib/constants'
import { formatDate } from '../lib/format'
import { welcomeLine } from '../lib/members'
import type { RetroStatus } from '../lib/types'

interface MyRetro {
  retro_id: string
  team_name: string
  sprint_name: string
  retro_date: string
  facilitator_name: string
  status: RetroStatus
  participant_count: number
  joined: boolean
}

/** Site vitrine : identification par e-mail, accueil personnalisé, puis accès direct à sa rétrospective. */
export function VitrinePage() {
  const { member, rolesLoading } = useAuth()
  const [confirmed, setConfirmed] = useState(false)

  if (rolesLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (member && confirmed) return <GuestHome />
  return <Landing onContinue={() => setConfirmed(true)} />
}

function GuestHome() {
  const { member } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [list, setList] = useState<MyRetro[] | null>(null)
  const [joining, setJoining] = useState<string | null>(null)

  async function open(r: MyRetro) {
    if (r.joined) return navigate(`/r/${r.retro_id}`)
    setJoining(r.retro_id)
    const { error } = await supabase.rpc('join_open_retro', { p_retro_id: r.retro_id })
    setJoining(null)
    if (error) {
      toast.error(error)
      setList((l) => l ?? [r])
    } else navigate(`/r/${r.retro_id}`)
  }

  useEffect(() => {
    supabase.rpc('list_my_retros').then(({ data, error }) => {
      if (error) toast.error(error)
      const rows = (data as MyRetro[] | null) ?? []
      const active = rows.filter((r) => r.status === 'open' || r.status === 'voting')
      // Une seule rétrospective en cours : accès direct.
      if (active.length === 1) open(active[0])
      else setList(rows)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (list === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Ouverture de votre rétrospective…" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
      {member && (
        <div className="animate-rise">
          <p className="text-xs font-semibold tracking-[0.18em] text-indigo-400 uppercase">Espace invité</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{welcomeLine(member)}</h1>
          {member.job_title && <p className="mt-1 text-slate-500">{member.job_title}</p>}
        </div>
      )}
      {list.length === 0 ? (
        <div className="card-premium rounded-3xl border border-slate-200">
          <EmptyState
            icon={<Lock className="size-9 text-slate-400" />}
            title="Aucune rétrospective pour le moment"
            description="Vous verrez ici les rétrospectives auxquelles l’administrateur vous invite. Vous pouvez aussi utiliser le lien d’invitation reçu par e-mail."
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((r, i) => (
            <div key={r.retro_id} className="animate-rise card-premium flex flex-col rounded-3xl border border-slate-200 p-6" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{r.team_name}</p>
                  <p className="mt-0.5 truncate text-xl font-bold text-slate-900">{r.sprint_name}</p>
                </div>
                <Badge className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> {formatDate(r.retro_date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Crown className="size-3.5" /> {r.facilitator_name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" /> {r.participant_count}
                </span>
              </div>
              <Button className="mt-5 self-start" onClick={() => open(r)} loading={joining === r.retro_id} variant={r.status === 'closed' ? 'secondary' : 'primary'}>
                {r.status === 'closed' ? (
                  <>
                    <CheckCircle2 className="size-4" /> Voir le rapport
                  </>
                ) : (
                  <>
                    {r.joined ? 'Reprendre' : 'Rejoindre'} <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
