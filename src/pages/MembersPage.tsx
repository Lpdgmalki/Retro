import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Download, ImagePlus, Pencil, Plus, Search, Trash2, Upload, Users, X } from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, PageLoader, Select, Switch, cx } from '../components/ui/primitives'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { downloadFile, toCsv } from '../lib/csv'
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, memberDisplayName } from '../lib/members'
import type { Civility, Member } from '../lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Draft = Pick<Member, 'email' | 'civility' | 'first_name' | 'last_name' | 'job_title' | 'photo_url' | 'active'>

const EMPTY: Draft = { email: '', civility: '', first_name: '', last_name: '', job_title: '', photo_url: '', active: true }

export function MembersPage() {
  const toast = useToast()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [editing, setEditing] = useState<Member | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Member | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('members').select('*').order('last_name').order('first_name')
    if (error) toast.error(error)
    setMembers((data as Member[] | null) ?? [])
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (members ?? []).filter(
      (m) =>
        (status === 'all' || (status === 'active' ? m.active : !m.active)) &&
        (!q || `${m.email} ${m.first_name} ${m.last_name} ${m.job_title}`.toLowerCase().includes(q)),
    )
  }, [members, query, status])

  if (!members) return <PageLoader />

  function exportCsv() {
    downloadFile(
      'annuaire.csv',
      toCsv(
        ['email', 'civilite', 'prenom', 'nom', 'poste', 'photo', 'actif'],
        members!.map((m) => [m.email, m.civility, m.first_name, m.last_name, m.job_title, m.photo_url, m.active ? 'oui' : 'non']),
      ),
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Annuaire des utilisateurs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Les personnes de l’annuaire s’identifient sur le site avec leur e-mail et participent aux rétrospectives.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Importer
          </Button>
          <Button variant="secondary" onClick={exportCsv} disabled={members.length === 0}>
            <Download className="size-4" /> Exporter
          </Button>
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Ajouter
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un nom, un e-mail, un poste…" className="pl-9" aria-label="Rechercher" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Statut">
          <option value="all">Tous ({members.length})</option>
          <option value="active">Actifs ({members.filter((m) => m.active).length})</option>
          <option value="inactive">Désactivés ({members.filter((m) => !m.active).length})</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" />}
            title={members.length ? 'Aucun résultat' : 'L’annuaire est vide'}
            description={members.length ? 'Modifiez la recherche.' : 'Ajoutez vos collaborateurs un par un ou importez un fichier CSV / Excel.'}
            action={
              members.length === 0 && (
                <Button onClick={() => setEditing('new')}>
                  <Plus className="size-4" /> Ajouter un utilisateur
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((m) => (
              <li key={m.id} className="group flex items-center gap-3 px-4 py-3">
                <Avatar name={memberDisplayName(m)} seed={m.id} src={m.photo_url} size="lg" className={cx(!m.active && 'opacity-40')} />
                <div className="min-w-0 flex-1">
                  <p className={cx('truncate text-sm font-semibold', m.active ? 'text-slate-900' : 'text-slate-400')}>
                    {m.civility && <span className="font-normal text-slate-500">{m.civility} </span>}
                    {[m.first_name, m.last_name].filter(Boolean).join(' ') || '—'}
                  </p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                  {m.job_title && <p className="truncate text-xs text-slate-400">{m.job_title}</p>}
                </div>
                {!m.active && <Badge className="bg-slate-100 text-slate-500 ring-slate-200">Désactivé</Badge>}
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(m)} aria-label={`Modifier ${m.email}`}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="hover:text-rose-600" onClick={() => setToDelete(m)} aria-label={`Supprimer ${m.email}`}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MemberFormModal
        open={editing !== null}
        member={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(m) => {
          setMembers((list) => {
            const l = list ?? []
            return l.some((x) => x.id === m.id) ? l.map((x) => (x.id === m.id ? m : x)) : [...l, m]
          })
        }}
      />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} existing={members} onDone={load} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer cet utilisateur ?"
        message={
          <>
            <strong>{toDelete?.email}</strong> ne pourra plus s’identifier. Ses contributions passées sont conservées. Pour suspendre
            temporairement l’accès, préférez « Désactiver » dans sa fiche.
          </>
        }
        confirmLabel="Supprimer"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const target = toDelete!
          setToDelete(null)
          const { error } = await supabase.from('members').delete().eq('id', target.id)
          if (error) return toast.error(error)
          setMembers((l) => (l ?? []).filter((x) => x.id !== target.id))
          toast.success('Utilisateur supprimé')
        }}
      />
    </div>
  )
}

function MemberFormModal({
  open,
  member,
  onClose,
  onSaved,
}: {
  open: boolean
  member: Member | null
  onClose: () => void
  onSaved: (m: Member) => void
}) {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setDraft(member ? { ...member } : EMPTY)
      setErrors({})
    }
  }, [open, member])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return toast.error('Format accepté : PNG, JPG, WEBP ou GIF.')
    if (file.size > PHOTO_MAX_BYTES) return toast.error('La photo ne doit pas dépasser 2 Mo.')
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    setUploading(false)
    if (error) return toast.error(error)
    set('photo_url', supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!EMAIL_RE.test(draft.email.trim())) errs.email = 'Adresse e-mail invalide.'
    if (draft.first_name.length > 60) errs.first_name = 'Maximum 60 caractères.'
    if (draft.last_name.length > 60) errs.last_name = 'Maximum 60 caractères.'
    if (draft.job_title.length > 100) errs.job_title = 'Maximum 100 caractères.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    const payload = {
      email: draft.email.trim().toLowerCase(),
      civility: draft.civility,
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      job_title: draft.job_title.trim(),
      photo_url: draft.photo_url,
      active: draft.active,
    }
    const res = member
      ? await supabase.from('members').update(payload).eq('id', member.id).select().single()
      : await supabase.from('members').insert(payload).select().single()
    setSaving(false)
    if (res.error) {
      if (/duplicate|unique/i.test(res.error.message)) setErrors({ email: 'Cet e-mail existe déjà dans l’annuaire.' })
      else toast.error(res.error)
      return
    }
    onSaved(res.data as Member)
    toast.success(member ? 'Fiche mise à jour' : 'Utilisateur ajouté')
    onClose()
  }

  const name = memberDisplayName({ ...draft, email: draft.email || '?' })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? 'Modifier l’utilisateur' : 'Ajouter un utilisateur'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="member-form" loading={saving} disabled={uploading}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex items-center gap-4">
          <Avatar name={name} seed={member?.id ?? name} src={draft.photo_url} size="xl" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPhoto} aria-label="Photo" />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
              <ImagePlus className="size-4" /> {draft.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
            </Button>
            {draft.photo_url && (
              <Button variant="ghost" size="sm" onClick={() => set('photo_url', '')}>
                <X className="size-4" /> Retirer
              </Button>
            )}
            <p className="w-full text-xs text-slate-400">PNG, JPG ou WEBP, 2 Mo maximum.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr_1fr]">
          <Field label="Civilité">
            {(id) => (
              <Select id={id} value={draft.civility} onChange={(e) => set('civility', e.target.value as Civility)}>
                <option value="">—</option>
                <option value="Mme">Mme</option>
                <option value="M.">M.</option>
              </Select>
            )}
          </Field>
          <Field label="Prénom" error={errors.first_name}>
            {(id) => <Input id={id} value={draft.first_name} onChange={(e) => set('first_name', e.target.value)} data-autofocus />}
          </Field>
          <Field label="Nom" error={errors.last_name}>
            {(id) => <Input id={id} value={draft.last_name} onChange={(e) => set('last_name', e.target.value)} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail professionnel" required error={errors.email}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} type="email" value={draft.email} invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} placeholder="prenom.nom@entreprise.com" />
            )}
          </Field>
          <Field label="Poste" error={errors.job_title}>
            {(id) => <Input id={id} value={draft.job_title} onChange={(e) => set('job_title', e.target.value)} placeholder="Ex. : Product Owner" />}
          </Field>
        </div>
        <Switch
          checked={draft.active}
          onChange={(v) => set('active', v)}
          label="Compte actif"
          description="Un compte désactivé ne peut plus s’identifier ni rejoindre de rétrospective."
        />
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Import CSV (Excel : « Enregistrer sous » → CSV)
// ---------------------------------------------------------------------------
interface ImportRow {
  email: string
  civility: Civility
  first_name: string
  last_name: string
  job_title: string
  photo_url: string
}

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

const HEADER_MAP: Record<string, keyof ImportRow> = {
  email: 'email', mail: 'email', courriel: 'email', adresseemail: 'email', emailprofessionnel: 'email',
  civilite: 'civility', civility: 'civility', titre: 'civility',
  prenom: 'first_name', firstname: 'first_name',
  nom: 'last_name', lastname: 'last_name', nomdefamille: 'last_name',
  poste: 'job_title', fonction: 'job_title', jobtitle: 'job_title', role: 'job_title',
  photo: 'photo_url', photourl: 'photo_url', image: 'photo_url',
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function toCivility(v: string): Civility {
  const s = v.toLowerCase().replace(/\./g, '').trim()
  if (['mme', 'madame', 'mlle', 'mademoiselle', 'f'].includes(s)) return 'Mme'
  if (['m', 'mr', 'monsieur', 'h'].includes(s)) return 'M.'
  return ''
}

export function parseMembersCsv(text: string): { rows: ImportRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { rows: [], errors: ['Fichier vide.'] }
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const headers = splitLine(lines[0], sep).map((h) => HEADER_MAP[normalizeHeader(h)])
  if (!headers.includes('email')) return { rows: [], errors: ['Colonne « email » introuvable dans la première ligne.'] }
  const rows: ImportRow[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  lines.slice(1).forEach((line, i) => {
    const cells = splitLine(line, sep)
    const row: ImportRow = { email: '', civility: '', first_name: '', last_name: '', job_title: '', photo_url: '' }
    headers.forEach((h, j) => {
      if (!h) return
      const v = cells[j] ?? ''
      if (h === 'civility') row.civility = toCivility(v)
      else row[h] = v.slice(0, h === 'job_title' ? 100 : h === 'photo_url' ? 1000 : 60) as never
    })
    row.email = row.email.toLowerCase()
    if (!EMAIL_RE.test(row.email)) errors.push(`Ligne ${i + 2} : e-mail invalide (« ${row.email || 'vide'} »).`)
    else if (seen.has(row.email)) errors.push(`Ligne ${i + 2} : e-mail en double (${row.email}).`)
    else {
      seen.add(row.email)
      rows.push(row)
    }
  })
  return { rows, errors }
}

function ImportDialog({ open, onClose, existing, onDone }: { open: boolean; onClose: () => void; existing: Member[]; onDone: () => void }) {
  const toast = useToast()
  const [parsed, setParsed] = useState<{ rows: ImportRow[]; errors: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setParsed(null)
  }, [open])

  const byEmail = useMemo(() => new Map(existing.map((m) => [m.email.toLowerCase(), m])), [existing])
  const toCreate = parsed?.rows.filter((r) => !byEmail.has(r.email)) ?? []
  const toUpdate = parsed?.rows.filter((r) => byEmail.has(r.email)) ?? []

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setParsed(parseMembersCsv(await file.text()))
  }

  async function run() {
    setBusy(true)
    try {
      if (toCreate.length) {
        const { error } = await supabase.from('members').insert(toCreate)
        if (error) throw error
      }
      for (const r of toUpdate) {
        const current = byEmail.get(r.email)!
        // Les cellules vides n'écrasent pas les données existantes.
        const patch = Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'email' && v !== ''))
        if (Object.keys(patch).length) {
          const { error } = await supabase.from('members').update(patch).eq('id', current.id)
          if (error) throw error
        }
      }
      toast.success(`${toCreate.length} ajouté(s), ${toUpdate.length} mis à jour`)
      onDone()
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function template() {
    downloadFile(
      'modele-annuaire.csv',
      toCsv(['email', 'civilite', 'prenom', 'nom', 'poste'], [['fatima.elmalki@entreprise.com', 'Mme', 'Fatima', 'El Malki', 'Product Owner']]),
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importer des utilisateurs"
      description="Fichier CSV (depuis Excel : Fichier → Enregistrer sous → CSV)."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={run} loading={busy} disabled={!parsed || parsed.rows.length === 0}>
            Importer {parsed?.rows.length ? `(${parsed.rows.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Colonnes reconnues : <code>email</code> (obligatoire), <code>civilite</code> (M. / Mme), <code>prenom</code>, <code>nom</code>,{' '}
          <code>poste</code>, <code>photo</code> (lien d’une image). Les e-mails déjà présents sont mis à jour.
        </p>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} aria-label="Fichier CSV" />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Choisir un fichier
          </Button>
          <Button variant="ghost" onClick={template}>
            <Download className="size-4" /> Télécharger un modèle
          </Button>
        </div>
        {parsed && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-4">
            <p>
              <strong>{toCreate.length}</strong> nouvel(s) utilisateur(s), <strong>{toUpdate.length}</strong> mise(s) à jour.
            </p>
            {parsed.rows.slice(0, 5).map((r) => (
              <p key={r.email} className="truncate text-xs text-slate-500">
                {r.email} — {[r.civility, r.first_name, r.last_name].filter(Boolean).join(' ')} {r.job_title && `· ${r.job_title}`}
              </p>
            ))}
            {parsed.rows.length > 5 && <p className="text-xs text-slate-400">… et {parsed.rows.length - 5} autre(s)</p>}
            {parsed.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-rose-600">
                {parsed.errors.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {parsed.errors.length > 8 && <li>… {parsed.errors.length - 8} autre(s) erreur(s)</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
