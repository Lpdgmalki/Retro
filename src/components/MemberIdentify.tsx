import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Briefcase, Mail, UserX } from 'lucide-react'
import { Avatar, Button, Input, cx } from './ui/primitives'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { memberDisplayName, welcomeLine } from '../lib/members'
import type { MemberProfile } from '../lib/types'

/** Carte « Bienvenue Mme … » avec photo et poste. */
export function WelcomeCard({
  member,
  onContinue,
  continueLabel = 'Continuer',
  loading,
}: {
  member: MemberProfile
  onContinue?: () => void
  continueLabel?: string
  loading?: boolean
}) {
  const { forgetIdentity } = useAuth()
  return (
    <div className="animate-pop-in flex flex-col items-center text-center">
      <Avatar name={memberDisplayName(member)} seed={member.id} src={member.photo_url} size="xl" className="ring-4 ring-white shadow-md" />
      <p className="mt-4 text-xl font-semibold text-slate-900">{welcomeLine(member)}</p>
      <p className="text-sm text-slate-600">{memberDisplayName(member)}</p>
      {member.job_title && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
          <Briefcase className="size-3.5" /> {member.job_title}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">{member.email}</p>
      {onContinue && (
        <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={onContinue} loading={loading}>
          {continueLabel} <ArrowRight className="size-4" />
        </Button>
      )}
      <button
        type="button"
        onClick={() => forgetIdentity()}
        className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        <UserX className="size-3.5" /> Ce n’est pas moi
      </button>
    </div>
  )
}

/**
 * Saisie de l'e-mail professionnel avec suggestions issues de l'annuaire.
 * Un clic sur une suggestion (ou la validation d'un e-mail exact) identifie la personne.
 */
export function MemberIdentify({ autoFocus }: { autoFocus?: boolean }) {
  const { identify } = useAuth()
  const toast = useToast()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MemberProfile[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    const id = ++requestId.current
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('suggest_members', { p_query: q })
      if (id !== requestId.current) return
      setSuggestions((data as MemberProfile[] | null) ?? [])
      setActive(-1)
      setOpen(true)
    }, 180)
    return () => clearTimeout(t)
  }, [query])

  async function choose(email: string) {
    setBusy(true)
    setError(null)
    try {
      await identify(email)
    } catch (e) {
      const msg = (e as { message?: string }).message ?? ''
      if (/inconnue/i.test(msg)) setError(msg)
      else toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (active >= 0 && suggestions[active]) return choose(suggestions[active].email)
    const q = query.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
      setError(suggestions.length ? 'Sélectionnez votre adresse dans la liste.' : 'Saisissez votre adresse e-mail complète.')
      return
    }
    choose(q)
  }

  return (
    <form onSubmit={submit} className="w-full">
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-sm font-medium text-slate-700">
        Votre adresse e-mail professionnelle
      </label>
      <div className="relative">
        <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={`${listId}-input`}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          invalid={Boolean(error)}
          placeholder="prenom.nom@entreprise.com"
          className="h-11 pl-9 text-base"
          onChange={(e) => {
            setQuery(e.target.value)
            setError(null)
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, suggestions.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, -1))
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Suggestions"
            className="animate-pop-in absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {suggestions.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(m.email)}
                onMouseEnter={() => setActive(i)}
                className={cx('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2', i === active && 'bg-indigo-50')}
              >
                <Avatar name={memberDisplayName(m)} seed={m.id} src={m.photo_url} />
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium text-slate-900">{m.email}</p>
                  <p className="truncate text-xs text-slate-500">
                    {memberDisplayName(m)}
                    {m.job_title && ` · ${m.job_title}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-4 w-full" loading={busy} disabled={query.trim().length < 3}>
        Continuer <ArrowRight className="size-4" />
      </Button>
    </form>
  )
}
