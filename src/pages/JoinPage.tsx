import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Crown, LinkIcon, Users } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, PageLoader } from '../components/ui/primitives'
import { Logo } from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
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
  const { user, displayName, setDisplayName } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(displayName)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!user || !token) return
    supabase.rpc('preview_retro', { p_token: token }).then(({ data, error: err }) => {
      if (err) toast.error(err)
      setPreview(((data as Preview[] | null) ?? [])[0] ?? null)
      setLoading(false)
    })
  }, [user, token, toast])

  useEffect(() => {
    if (!name && displayName) setName(displayName)
  }, [displayName, name])

  if (loading) return <PageLoader label="Vérification du lien…" />
  if (preview?.already_joined) return <Navigate to={`/r/${preview.retro_id}`} replace />

  async function join(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Choisissez un pseudo pour que l’équipe vous reconnaisse.')
    if (clean.length > LIMITS.displayName) return setError(`Maximum ${LIMITS.displayName} caractères.`)
    setJoining(true)
    const { data, error: err } = await supabase.rpc('join_retro', { p_token: token, p_display_name: clean })
    if (err) {
      setJoining(false)
      toast.error(err)
      return
    }
    setDisplayName(clean)
    navigate(`/r/${data as string}`, { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Logo className="mb-8" />
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
          <form onSubmit={join} className="mt-6 space-y-4">
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
                  maxLength={LIMITS.displayName + 10}
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={joining}>
              Rejoindre la rétrospective
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-400">
            Aucun compte requis. Votre accès est mémorisé sur ce navigateur.
          </p>
        </Card>
      )}
    </div>
  )
}
