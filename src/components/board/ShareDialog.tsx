import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Link2, Mail, Search, UserCheck, UserPlus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Avatar, Button, Input, Spinner, cx } from '../ui/primitives'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { memberDisplayName } from '../../lib/members'
import type { Member, Participant, Retro } from '../../lib/types'

/** Invitation (réservée aux administrateurs) : lien de partage et invitations nominatives. */
export function ShareDialog({
  open,
  onClose,
  retro,
  teamName,
  participants,
}: {
  open: boolean
  onClose: () => void
  retro: Retro
  teamName: string
  participants: Participant[]
}) {
  const toast = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const [inv, mem, list] = await Promise.all([
        supabase.from('retro_invites').select('token').eq('retro_id', retro.id).maybeSingle(),
        supabase.from('members').select('*').eq('active', true).order('last_name').order('first_name'),
        supabase.from('retro_member_invites').select('member_id').eq('retro_id', retro.id),
      ])
      if (cancelled) return
      if (inv.error) toast.error(inv.error)
      setToken(inv.data?.token ?? null)
      setMembers((mem.data as Member[] | null) ?? [])
      setInvited(new Set(((list.data as { member_id: string }[] | null) ?? []).map((r) => r.member_id)))
    })()
    return () => {
      cancelled = true
    }
  }, [open, retro.id, toast])

  const url = token ? `${window.location.origin}/join/${token}` : ''
  const joined = useMemo(() => new Set(participants.map((p) => p.member_id).filter(Boolean)), [participants])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (members ?? []).filter((m) => !q || `${m.email} ${m.first_name} ${m.last_name} ${m.job_title}`.toLowerCase().includes(q))
  }, [members, query])

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.getElementById('share-url') as HTMLInputElement | null
      el?.select()
      document.execCommand('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggle(m: Member) {
    setBusy(m.id)
    const isInvited = invited.has(m.id)
    const { error } = isInvited
      ? await supabase.from('retro_member_invites').delete().eq('retro_id', retro.id).eq('member_id', m.id)
      : await supabase.from('retro_member_invites').insert({ retro_id: retro.id, member_id: m.id })
    setBusy(null)
    if (error) return toast.error(error)
    setInvited((s) => {
      const next = new Set(s)
      if (isInvited) next.delete(m.id)
      else next.add(m.id)
      return next
    })
  }

  async function inviteAll() {
    const toAdd = filtered.filter((m) => !invited.has(m.id))
    if (toAdd.length === 0) return
    const { error } = await supabase.from('retro_member_invites').insert(toAdd.map((m) => ({ retro_id: retro.id, member_id: m.id })))
    if (error) return toast.error(error)
    setInvited((s) => new Set([...s, ...toAdd.map((m) => m.id)]))
    toast.success(`${toAdd.length} personne(s) invitée(s)`)
  }

  const subject = encodeURIComponent(`Rétrospective ${teamName} — ${retro.sprint_name}`)
  const body = encodeURIComponent(
    `Bonjour,\n\nVous êtes invité(e) à la rétrospective « ${retro.sprint_name} » :\n${url}\n\nIdentifiez-vous simplement avec votre adresse e-mail professionnelle.\n`,
  )
  const emails = (members ?? []).filter((m) => invited.has(m.id)).map((m) => m.email).join(',')

  return (
    <Modal open={open} onClose={onClose} title="Inviter des participants" description="Seuls les administrateurs peuvent inviter." size="lg">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Membres de l’annuaire</h3>
          <p className="text-xs text-slate-500">
            Une personne invitée arrive directement sur cette rétrospective dès qu’elle s’identifie sur le site — aucun lien à lui envoyer.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="pl-9" aria-label="Rechercher un membre" />
            </div>
            <Button variant="secondary" onClick={inviteAll} disabled={!members?.length}>
              <UserPlus className="size-4" /> Tout inviter
            </Button>
          </div>
          {members === null ? (
            <Spinner />
          ) : members.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">L’annuaire est vide : ajoutez des utilisateurs dans « Annuaire ».</p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {filtered.map((m) => {
                const isInvited = invited.has(m.id)
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar name={memberDisplayName(m)} seed={m.id} src={m.photo_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{memberDisplayName(m)}</p>
                      <p className="truncate text-xs text-slate-500">{m.job_title || m.email}</p>
                    </div>
                    {joined.has(m.id) && <span className="text-xs text-emerald-600">a rejoint</span>}
                    <Button
                      size="sm"
                      variant={isInvited ? 'subtle' : 'secondary'}
                      loading={busy === m.id}
                      onClick={() => toggle(m)}
                      aria-label={`${isInvited ? 'Retirer l’invitation de' : 'Inviter'} ${m.email}`}
                    >
                      {isInvited ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                      {isInvited ? 'Invité' : 'Inviter'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className={cx('space-y-3 border-t border-slate-100 pt-5')}>
          <h3 className="text-sm font-semibold text-slate-900">Lien d’invitation</h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input id="share-url" readOnly value={url || 'Chargement…'} className="pl-9 font-mono text-xs" onFocus={(e) => e.target.select()} />
            </div>
            <Button onClick={copy} disabled={!url}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
          <a
            href={`mailto:${emails}?subject=${subject}&body=${body}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            <Mail className="size-4" /> Envoyer l’invitation par e-mail{emails ? ' aux personnes invitées' : ''}
          </a>
        </section>
      </div>
    </Modal>
  )
}
