import { Field, Input, Switch, Textarea } from '../ui/primitives'
import { LIMITS } from '../../lib/constants'

export interface RetroSettingsValues {
  sprint_name: string
  retro_date: string
  facilitator_name: string
  goal: string
  closes_at: string // valeur datetime-local
  max_votes: number
  allow_multiple_votes: boolean
  confidential_votes: boolean
  allow_anonymous: boolean
}

export function validateRetroSettings(v: RetroSettingsValues): Record<string, string> {
  const e: Record<string, string> = {}
  if (!v.sprint_name.trim()) e.sprint_name = 'Indiquez le nom ou le numéro du sprint.'
  else if (v.sprint_name.trim().length > LIMITS.sprintName) e.sprint_name = `Maximum ${LIMITS.sprintName} caractères.`
  if (!v.retro_date) e.retro_date = 'La date est obligatoire.'
  if (!v.facilitator_name.trim()) e.facilitator_name = 'Indiquez le facilitateur.'
  else if (v.facilitator_name.trim().length > LIMITS.facilitatorName) e.facilitator_name = `Maximum ${LIMITS.facilitatorName} caractères.`
  if (v.goal.length > LIMITS.goal) e.goal = `Maximum ${LIMITS.goal} caractères.`
  if (!Number.isInteger(v.max_votes) || v.max_votes < 1 || v.max_votes > 50) e.max_votes = 'Entre 1 et 50 votes.'
  if (v.closes_at && Number.isNaN(new Date(v.closes_at).getTime())) e.closes_at = 'Date invalide.'
  return e
}

export function RetroInfoFields({
  values,
  errors,
  onChange,
}: {
  values: RetroSettingsValues
  errors: Record<string, string>
  onChange: <K extends keyof RetroSettingsValues>(k: K, v: RetroSettingsValues[K]) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Sprint" required error={errors.sprint_name}>
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            value={values.sprint_name}
            invalid={Boolean(errors.sprint_name)}
            onChange={(e) => onChange('sprint_name', e.target.value)}
            placeholder="Ex. : Sprint 24"
          />
        )}
      </Field>
      <Field label="Date de la rétrospective" required error={errors.retro_date}>
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            type="date"
            value={values.retro_date}
            invalid={Boolean(errors.retro_date)}
            onChange={(e) => onChange('retro_date', e.target.value)}
          />
        )}
      </Field>
      <Field label="Facilitateur" required error={errors.facilitator_name}>
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            value={values.facilitator_name}
            invalid={Boolean(errors.facilitator_name)}
            onChange={(e) => onChange('facilitator_name', e.target.value)}
            placeholder="Nom du Scrum Master"
          />
        )}
      </Field>
      <Field label="Clôture de la session" optional error={errors.closes_at} hint="Au-delà, plus aucune contribution ni commentaire.">
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            type="datetime-local"
            value={values.closes_at}
            onChange={(e) => onChange('closes_at', e.target.value)}
          />
        )}
      </Field>
      <Field
        label="Objectif ou contexte du sprint"
        optional
        error={errors.goal}
        className="sm:col-span-2"
        counter={{ value: values.goal.length, max: LIMITS.goal }}
      >
        {(id, d) => (
          <Textarea
            id={id}
            aria-describedby={d}
            value={values.goal}
            onChange={(e) => onChange('goal', e.target.value)}
            placeholder="Ex. : livrer le parcours de paiement mobile en bêta"
            rows={3}
          />
        )}
      </Field>
    </div>
  )
}

export function RetroVoteFields({
  values,
  errors,
  onChange,
}: {
  values: RetroSettingsValues
  errors: Record<string, string>
  onChange: <K extends keyof RetroSettingsValues>(k: K, v: RetroSettingsValues[K]) => void
}) {
  return (
    <div className="space-y-4">
      <Field label="Votes par participant" error={errors.max_votes} hint="Chaque participant répartit ce nombre de votes.">
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            type="number"
            min={1}
            max={50}
            value={Number.isNaN(values.max_votes) ? '' : values.max_votes}
            invalid={Boolean(errors.max_votes)}
            onChange={(e) => onChange('max_votes', e.target.valueAsNumber)}
            className="max-w-28"
          />
        )}
      </Field>
      <Switch
        checked={values.allow_multiple_votes}
        onChange={(v) => onChange('allow_multiple_votes', v)}
        label="Autoriser plusieurs votes sur la même idée"
        description="Par défaut, un participant ne peut voter qu’une fois par idée."
      />
      <Switch
        checked={values.confidential_votes}
        onChange={(v) => onChange('confidential_votes', v)}
        label="Vote confidentiel"
        description="Votants et résultats masqués pendant le vote ; seuls les totaux sont affichés après la clôture."
      />
      <Switch
        checked={values.allow_anonymous}
        onChange={(v) => onChange('allow_anonymous', v)}
        label="Autoriser les contributions anonymes"
        description="Les participants peuvent masquer leur nom sur une carte."
      />
    </div>
  )
}
