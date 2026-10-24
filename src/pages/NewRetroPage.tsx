import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Copy } from 'lucide-react'
import { Button, Card, Field, Input, PageLoader, Select } from '../components/ui/primitives'
import { RetroInfoFields, RetroVoteFields, validateRetroSettings, type RetroSettingsValues } from '../components/board/RetroSettingsFields'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useMyRetros } from '../hooks/useMyRetros'
import { supabase } from '../lib/supabase'
import { LIMITS } from '../lib/constants'
import { fromDateTimeLocal, todayIso } from '../lib/format'
import type { Retro } from '../lib/types'

const NEW_TEAM = '__new__'

function nextSprintName(name: string): string {
  const m = name.match(/^(.*?)(\d+)(\D*)$/)
  return m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : `${name} (suite)`
}

export function NewRetroPage() {
  const { user, displayName, setDisplayName } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fromId = params.get('from')
  const { teams, loading: teamsLoading } = useMyRetros(user?.id)

  const [teamChoice, setTeamChoice] = useState<string>(NEW_TEAM)
  const [teamName, setTeamName] = useState('')
  const [myName, setMyName] = useState(displayName)
  const [values, setValues] = useState<RetroSettingsValues>({
    sprint_name: '',
    retro_date: todayIso(),
    facilitator_name: displayName,
    goal: '',
    closes_at: '',
    max_votes: 5,
    allow_multiple_votes: false,
    confidential_votes: false,
    allow_anonymous: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState<Retro | null>(null)
  const [sourceLoading, setSourceLoading] = useState(Boolean(fromId))

  // Pré-remplissage lors d'une duplication.
  useEffect(() => {
    if (!fromId) return
    supabase
      .from('retros')
      .select('*')
      .eq('id', fromId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const r = data as Retro
          setSource(r)
          setTeamChoice(r.team_id)
          setValues((v) => ({
            ...v,
            sprint_name: nextSprintName(r.sprint_name),
            facilitator_name: r.facilitator_name,
            goal: '',
            max_votes: r.max_votes,
            allow_multiple_votes: r.allow_multiple_votes,
            confidential_votes: r.confidential_votes,
            allow_anonymous: r.allow_anonymous,
          }))
        }
        setSourceLoading(false)
      })
  }, [fromId])

  // Par défaut, sélectionne la première équipe existante.
  useEffect(() => {
    if (!fromId && teams.length > 0 && teamChoice === NEW_TEAM && !teamName) setTeamChoice(teams[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams])

  const onChange = <K extends keyof RetroSettingsValues>(k: K, v: RetroSettingsValues[K]) => setValues((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validateRetroSettings(values)
    if (teamChoice === NEW_TEAM) {
      if (!teamName.trim()) errs.team_name = 'Indiquez le nom de l’équipe ou du projet.'
      else if (teamName.trim().length > LIMITS.teamName) errs.team_name = `Maximum ${LIMITS.teamName} caractères.`
    }
    const pseudo = (myName || values.facilitator_name).trim()
    if (pseudo.length > LIMITS.displayName) errs.my_name = `Maximum ${LIMITS.displayName} caractères.`
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Veuillez corriger les champs signalés.')
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('create_retro', {
        p_team_id: teamChoice === NEW_TEAM ? null : teamChoice,
        p_team_name: teamChoice === NEW_TEAM ? teamName.trim() : null,
        p_sprint_name: values.sprint_name.trim(),
        p_retro_date: values.retro_date,
        p_facilitator_name: values.facilitator_name.trim(),
        p_goal: values.goal.trim(),
        p_closes_at: fromDateTimeLocal(values.closes_at),
        p_max_votes: values.max_votes,
        p_allow_multiple_votes: values.allow_multiple_votes,
        p_confidential_votes: values.confidential_votes,
        p_allow_anonymous: values.allow_anonymous,
        p_display_name: pseudo,
      })
      if (error) throw error
      if (!displayName) setDisplayName(pseudo)
      toast.success('Rétrospective créée')
      navigate(`/r/${(data as Retro).id}`, { state: { share: true } })
    } catch (err) {
      toast.error(err)
      setSaving(false)
    }
  }

  if (teamsLoading || sourceLoading) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Retour
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Nouvelle rétrospective</h1>
      <p className="mt-1 text-sm text-slate-500">
        Elle démarre en <strong>brouillon</strong> : vous pourrez la préparer puis ouvrir les contributions quand l’équipe est prête.
      </p>
      {source && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          <Copy className="size-4" /> Paramètres repris de « {source.sprint_name} ».
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Équipe</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.length > 0 && (
              <Field label="Équipe ou projet" required>
                {(id) => (
                  <Select id={id} value={teamChoice} onChange={(e) => setTeamChoice(e.target.value)}>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                    <option value={NEW_TEAM}>+ Nouvelle équipe…</option>
                  </Select>
                )}
              </Field>
            )}
            {teamChoice === NEW_TEAM && (
              <Field label={teams.length ? 'Nom de la nouvelle équipe' : 'Nom de l’équipe ou du projet'} required error={errors.team_name}>
                {(id, d) => (
                  <Input
                    id={id}
                    aria-describedby={d}
                    value={teamName}
                    invalid={Boolean(errors.team_name)}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Ex. : Équipe Paiement"
                    autoFocus
                  />
                )}
              </Field>
            )}
            <Field label="Votre pseudo dans la session" error={errors.my_name} hint="Affiché aux participants à côté de vos cartes.">
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  placeholder={values.facilitator_name || 'Ex. : Camille'}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Sprint</h2>
          <RetroInfoFields values={values} errors={errors} onChange={onChange} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Vote et contributions</h2>
          <RetroVoteFields values={values} errors={errors} onChange={onChange} />
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/">
            <Button variant="secondary" className="w-full sm:w-auto">
              Annuler
            </Button>
          </Link>
          <Button type="submit" loading={saving}>
            Créer la rétrospective
          </Button>
        </div>
      </form>
    </div>
  )
}
