import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Crown, LinkIcon, Users } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, PageLoader } from '../components/ui/primitives'
import { BrandMark } from '../components/layout/GuestShell'
import { MemberIdentify, WelcomeCard } from '../components/MemberIdentify'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { LIMITS, STATUS_BADGE, STATUS_LABEL } from '../lib/constants'
import { formatDate } from '../lib/format'
import type { RetroStatus } from '../lib/types'

interface Preview {
  retro_id: string
  team_name: string
  sprint_name: string
  retro_date: string
  facilitator_name: string
  status: RetroStatus
  participant_count: number
  already_joined: boolean
}

export function JoinPage() {
  const { token } = useParams()
  const { user, member, isAdmin, rolesLoading, displayName, setDisplayName } = useAuth()
  const { settings } = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [guestMode, setGuestMode] = useState(false)
  const [name, setName] = useState(displayName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !token) return
    supabase.rpc('preview_retro', { p_token: token }).then(({ data, error: err }) => {
      if (err) toast.error(err)
      setPreview(((data as Preview[] | null) ?? [])[0] ?? null)
      setLoading(false)
    })
  }, [user, token, toast])

  if (loading || rolesLoading) return <PageLoader label="Vérification du lien…" />
  if (preview?.already_joined) return <Navigate to={`/r/${preview.retro_id}`} replace />

  async function join(pseudo: string | null) {
    setJoining(true)
    const { data, error: err } = await supabase.rpc('join_retro', { p_token: token, p_display_name: pseudo })
    if (err) {
      setJoining(false)
      toast.error(err)
      return
    }
    navigate(`/r/${data as string}`, { replace: true })
  }

  function joinAsGuest(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Choisissez un pseudo pour que l’équipe vous reconnaisse.')
    if (clean.length > LIMITS.displayName) return setError(`Maximum ${LIMITS.displayName} caractères.`)
    setDisplayName(clean)
    join(clean)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2 font-semibold text-slate-900">
        <BrandMark />
        {settings.org_name}
      </Link>
      {!preview ? (
        <Card className="w-full max-w-md">
          <EmptyState
            icon={<LinkIcon className="size-9" />}
            title="Lien d’invitation invalide"
            description="Ce lien n’existe pas ou la rétrospective a été supprimée. Demandez un nouveau lien au facilitateur."
            action={
              <Button variant="secondary" onClick={() => navigate('/')}>
                Aller à l’accueil
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="animate-pop-in w-full max-w-md p-6 sm:p-8">
          <p className="text-xs font-medium tracking-wide text-indigo-600 uppercase">Invitation à une rétrospective</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{preview.sprint_name}</h1>
          <p className="text-sm text-slate-600">{preview.team_name}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {formatDate(preview.retro_date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Crown className="size-3.5" /> {preview.facilitator_name}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {preview.participant_count} participant(s)
            </span>
            <Badge className={STATUS_BADGE[preview.status]}>{STATUS_LABEL[preview.status]}</Badge>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            {isAdmin ? (
              <Button size="lg" className="w-full" loading={joining} onClick={() => join(null)}>
                Ouvrir en tant qu’administrateur
              </Button>
            ) : member ? (
              <WelcomeCard member={member} onContinue={() => join(null)} continueLabel="Rejoindre la rétrospective" loading={joining} />
            ) : guestMode ? (
              <form onSubmit={joinAsGuest} className="space-y-4">
                <Field label="Votre nom ou pseudo" required error={error} hint="Visible par les autres participants.">
                  {(id, d) => (
                    <Input
                      id={id}
                      aria-describedby={d}
                      value={name}
                      invalid={Boolean(error)}
                      onChange={(e) => {
                        setName(e.target.value)
                        setError(null)
                      }}
                      placeholder="Ex. : Camille D."
                      autoFocus
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={joining}>
                  Rejoindre la rétrospective
                </Button>
                <button type="button" className="w-full text-center text-xs text-slate-500 hover:text-slate-700" onClick={() => setGuestMode(false)}>
                  Je suis dans l’annuaire
                </button>
              </form>
            ) : (
              <>
                <MemberIdentify autoFocus />
                {settings.allow_external_guests && (
                  <button type="button" className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-700" onClick={() => setGuestMode(true)}>
                    Je ne suis pas dans l’annuaire : participer avec un pseudo
                  </button>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
