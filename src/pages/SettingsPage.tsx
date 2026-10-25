import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Button, Card, Field, Input, Switch, Textarea } from '../components/ui/primitives'
import { ConfirmDialog } from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import type { AppSettings } from '../lib/types'

export function SettingsPage() {
  const { settings, update } = useSettings()
  const toast = useToast()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(settings), [settings])

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  async function save() {
    if (!draft.org_name.trim()) return setError('Le nom de l’organisation est obligatoire.')
    if (!Number.isInteger(draft.default_max_votes) || draft.default_max_votes < 1 || draft.default_max_votes > 50)
      return setError('Votes par participant : entre 1 et 50.')
    setError(null)
    setSaving(true)
    try {
      await update({ ...draft, org_name: draft.org_name.trim() })
      toast.success('Paramètres enregistrés')
    } catch (e) {
      toast.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paramètres</h1>
          <p className="mt-1 text-sm text-slate-500">Réglages globaux de l’application et du site vitrine.</p>
        </div>
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Enregistrer
        </Button>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Site vitrine</h2>
        <Field label="Nom de l’organisation" counter={{ value: draft.org_name.length, max: 80 }}>
          {(id) => <Input id={id} value={draft.org_name} onChange={(e) => set('org_name', e.target.value)} />}
        </Field>
        <Field label="Titre d’accueil" counter={{ value: draft.welcome_title.length, max: 120 }}>
          {(id) => <Input id={id} value={draft.welcome_title} onChange={(e) => set('welcome_title', e.target.value)} />}
        </Field>
        <Field label="Message d’accueil" counter={{ value: draft.welcome_message.length, max: 1000 }}>
          {(id) => <Textarea id={id} rows={3} value={draft.welcome_message} onChange={(e) => set('welcome_message', e.target.value)} />}
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Accès des invités</h2>
        <Switch
          checked={draft.email_suggestions}
          onChange={(v) => set('email_suggestions', v)}
          label="Suggérer les adresses e-mail pendant la saisie"
          description="Désactivé : la personne doit taper son adresse complète (l’annuaire n’est pas consultable depuis le site)."
        />
        <Switch
          checked={draft.allow_external_guests}
          onChange={(v) => set('allow_external_guests', v)}
          label="Autoriser les invités hors annuaire"
          description="Une personne absente de l’annuaire peut rejoindre via un lien d’invitation avec un simple pseudo."
        />
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Valeurs par défaut des nouvelles rétrospectives</h2>
        <Field label="Votes par participant">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={50}
              className="max-w-28"
              value={Number.isNaN(draft.default_max_votes) ? '' : draft.default_max_votes}
              onChange={(e) => set('default_max_votes', e.target.valueAsNumber)}
            />
          )}
        </Field>
        <Switch checked={draft.default_participants_can_add} onChange={(v) => set('default_participants_can_add', v)} label="Les participants peuvent proposer des cartes" description="Sinon, ils votent et commentent uniquement." />
        <Switch checked={draft.default_allow_multiple_votes} onChange={(v) => set('default_allow_multiple_votes', v)} label="Plusieurs votes sur la même idée" />
        <Switch checked={draft.default_confidential_votes} onChange={(v) => set('default_confidential_votes', v)} label="Vote confidentiel" />
        <Switch checked={draft.default_allow_anonymous} onChange={(v) => set('default_allow_anonymous', v)} label="Contributions anonymes autorisées" />
      </Card>

      <AdminsCard />
    </div>
  )
}

interface AdminRow {
  user_id: string
  email: string
  created_at: string
}

function AdminsCard() {
  const toast = useToast()
  const { user } = useAuth()
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [toRemove, setToRemove] = useState<AdminRow | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_admins')
    if (error) toast.error(error)
    setAdmins((data as AdminRow[] | null) ?? [])
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function add() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Adresse e-mail invalide.')
    setAdding(true)
    const { error } = await supabase.rpc('add_admin', { p_email: email.trim() })
    setAdding(false)
    if (error) return toast.error(error)
    setEmail('')
    toast.success('Administrateur ajouté')
    load()
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="size-4 text-slate-500" /> Administrateurs
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Pour ajouter un administrateur, la personne crée d’abord son compte sur la page de connexion du back office (« Créer un compte »),
          puis vous saisissez son e-mail ci-dessous.
        </p>
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {admins.map((a) => (
          <li key={a.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {a.email} {a.user_id === user?.id && <span className="font-normal text-slate-400">(vous)</span>}
              </p>
              <p className="text-xs text-slate-400">Depuis le {formatDate(a.created_at)}</p>
            </div>
            {admins.length > 1 && (
              <Button variant="ghost" size="icon-sm" className="hover:text-rose-600" onClick={() => setToRemove(a)} aria-label={`Retirer ${a.email}`}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail du compte à promouvoir" aria-label="E-mail du nouvel administrateur" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button variant="secondary" onClick={add} loading={adding}>
          <UserPlus className="size-4" /> Ajouter
        </Button>
      </div>
      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Retirer cet administrateur ?"
        message={`${toRemove?.email} n’aura plus accès au back office.`}
        confirmLabel="Retirer"
        danger
        onCancel={() => setToRemove(null)}
        onConfirm={async () => {
          const { error } = await supabase.rpc('remove_admin', { p_user_id: toRemove!.user_id })
          setToRemove(null)
          if (error) return toast.error(error)
          load()
        }}
      />
    </Card>
  )
}
