import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, Crown, History, Users } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Spinner, cx } from '../components/ui/primitives'
import { MemberIdentify, WelcomeCard } from '../components/MemberIdentify'
import { BrandMark } from '../components/layout/GuestShell'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useMyRetros } from '../hooks/useMyRetros'
import { supabase } from '../lib/supabase'
import { CATEGORIES, STATUS_BADGE, STATUS_LABEL } from '../lib/constants'
import { formatDate } from '../lib/format'
import { welcomeLine } from '../lib/members'
import type { RetroStatus } from '../lib/types'

interface OpenRetro {
  retro_id: string
  team_name: string
  sprint_name: string
  retro_date: string
  facilitator_name: string
  status: RetroStatus
  participant_count: number
  joined: boolean
}

/** Site vitrine : identification par e-mail, puis accès aux rétrospectives en cours. */
export function VitrinePage() {
  const { member, rolesLoading } = useAuth()
  const { settings } = useSettings()
  const [confirmed, setConfirmed] = useState(false)

  if (rolesLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!member || !confirmed) {
    return (
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-gradient-to-b from-indigo-100/70 to-transparent" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <BrandMark className="size-12" />
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{settings.welcome_title}</h1>
            <p className="mt-4 max-w-lg text-lg whitespace-pre-line text-slate-600">{settings.welcome_message}</p>
            <ul className="mt-8 grid max-w-md grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <li key={c.id} className={cx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium', c.soft, c.text)}>
                  <c.icon className="size-4 shrink-0" /> {c.label}
                </li>
              ))}
            </ul>
          </div>
          <Card className="mx-auto w-full max-w-md p-6 shadow-lg sm:p-8">
            {member ? (
              <WelcomeCard member={member} onContinue={() => setConfirmed(true)} continueLabel="Accéder à mes rétrospectives" />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Identifiez-vous</h2>
                <p className="mt-1 mb-5 text-sm text-slate-500">Commencez à saisir votre e-mail, puis choisissez votre adresse.</p>
                <MemberIdentify autoFocus />
              </>
            )}
          </Card>
        </div>
      </div>
    )
  }

  return <GuestHome />
}

function GuestHome() {
  const { member, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState<OpenRetro[] | null>(null)
  const [joining, setJoining] = useState<string | null>(null)
  const { retros } = useMyRetros(user?.id)

  useEffect(() => {
    supabase.rpc('list_open_retros').then(({ data, error }) => {
      if (error) toast.error(error)
      setOpen((data as OpenRetro[] | null) ?? [])
    })
  }, [toast])

  async function join(r: OpenRetro) {
    if (r.joined) return navigate(`/r/${r.retro_id}`)
    setJoining(r.retro_id)
    const { error } = await supabase.rpc('join_open_retro', { p_retro_id: r.retro_id })
    setJoining(null)
    if (error) toast.error(error)
    else navigate(`/r/${r.retro_id}`)
  }

  const past = retros.filter((r) => r.myRole && r.status === 'closed')

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-4">
        <WelcomeHeader />
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Rétrospectives en cours
        </h2>
        {open === null ? (
          <Spinner />
        ) : open.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-8" />}
              title="Aucune rétrospective en cours"
              description="Revenez lorsque votre facilitateur aura ouvert la session, ou utilisez le lien qu’il vous a envoyé."
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {open.map((r) => (
              <Card key={r.retro_id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{r.team_name}</p>
                    <p className="mt-0.5 truncate text-lg font-semibold text-slate-900">{r.sprint_name}</p>
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
                <Button className="mt-4 self-start" onClick={() => join(r)} loading={joining === r.retro_id}>
                  {r.joined ? (
                    <>
                      <CheckCircle2 className="size-4" /> Reprendre
                    </>
                  ) : (
                    <>
                      {r.status === 'voting' ? 'Rejoindre et voter' : 'Rejoindre'} <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <History className="size-4 text-slate-400" /> Mes rétrospectives passées
          </h2>
          <Card className="divide-y divide-slate-100">
            {past.slice(0, 10).map((r) => (
              <Link key={r.id} to={`/r/${r.id}/summary`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{r.sprint_name}</p>
                  <p className="text-xs text-slate-500">
                    {r.teams?.name} · {formatDate(r.retro_date)}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-indigo-600">Voir la synthèse</span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {member && <p className="text-center text-xs text-slate-400">Connecté en tant que {member.email}</p>}
    </div>
  )
}

function WelcomeHeader() {
  const { member } = useAuth()
  if (!member) return null
  return (
    <div className="flex items-center gap-4">
      <img
        src={member.photo_url || undefined}
        alt=""
        className={cx('size-14 rounded-full bg-slate-100 object-cover ring-4 ring-white shadow', !member.photo_url && 'hidden')}
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{welcomeLine(member)}</h1>
        {member.job_title && <p className="text-sm text-slate-500">{member.job_title}</p>}
      </div>
    </div>
  )
}
