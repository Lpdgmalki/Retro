import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react'
import { Button, Card, Field, Input, PageLoader } from '../components/ui/primitives'
import { BrandMark } from '../components/layout/GuestShell'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'

/** Protège les routes du back office. */
export function AdminGuard() {
  const { isAdmin, rolesLoading } = useAuth()
  if (rolesLoading) return <PageLoader label="Vérification des droits…" />
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return <Outlet />
}

type Mode = 'login' | 'signup' | 'first'

export function AdminLoginPage() {
  const { isAdmin, rolesLoading, isAnonymous, user, signInWithPassword, signUpWithPassword, signOut, refreshRoles } = useAuth()
  const { settings } = useSettings()
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('has_admin').then(({ data }) => {
      setHasAdmin(Boolean(data))
      if (!data) setMode('first')
    })
  }, [user?.id])

  // Compte e-mail connecté mais pas encore administrateur : premier admin si aucun n'existe.
  useEffect(() => {
    if (!user || isAnonymous || isAdmin || rolesLoading || hasAdmin !== false) return
    supabase.rpc('claim_first_admin').then(({ error: err }) => {
      if (!err) refreshRoles()
    })
  }, [user, isAnonymous, isAdmin, rolesLoading, hasAdmin, refreshRoles])

  if (rolesLoading || hasAdmin === null) return <PageLoader />
  if (isAdmin) return <Navigate to="/admin" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Adresse e-mail invalide.')
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.')
    if (mode !== 'login' && password !== confirm) return setError('Les mots de passe ne correspondent pas.')
    setBusy(true)
    try {
      if (mode === 'login') {
        await signInWithPassword(email.trim(), password)
        const { data } = await supabase.rpc('is_admin')
        if (!data && hasAdmin) setError('Ce compte n’a pas les droits d’administration. Demandez à un administrateur de vous ajouter (Paramètres → Administrateurs).')
      } else {
        const needsConfirmation = await signUpWithPassword(email.trim(), password)
        if (needsConfirmation) {
          setInfo('Compte créé. Ouvrez l’e-mail de confirmation que vous venez de recevoir, puis connectez-vous ici.')
          setMode('login')
        } else if (hasAdmin) {
          setInfo('Compte créé. Un administrateur doit maintenant vous ajouter (Paramètres → Administrateurs).')
        }
      }
    } catch (err) {
      const msg = errorMessage(err)
      setError(/Invalid login credentials/i.test(msg) ? 'E-mail ou mot de passe incorrect.' : /Email not confirmed/i.test(msg) ? 'Confirmez d’abord votre adresse e-mail (lien reçu par e-mail).' : /already registered/i.test(msg) ? 'Un compte existe déjà avec cet e-mail : connectez-vous.' : msg)
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'first' ? 'Créer le compte administrateur' : mode === 'signup' ? 'Créer un compte' : 'Connexion au back office'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2 font-semibold text-slate-900">
        <BrandMark />
        {settings.org_name}
      </Link>
      <Card className="animate-pop-in w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            {mode === 'first' ? <ShieldCheck className="size-5" /> : <KeyRound className="size-5" />}
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-500">Espace réservé aux administrateurs</p>
          </div>
        </div>

        {mode === 'first' && (
          <p className="mb-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            Aucun administrateur n’existe encore : ce compte deviendra l’administrateur principal de l’application.
          </p>
        )}
        {!isAnonymous && user?.email && !isAdmin && mode === 'login' && hasAdmin && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Connecté en tant que {user.email}, sans droits d’administration.{' '}
            <button type="button" className="font-medium underline" onClick={() => signOut()}>
              Se déconnecter
            </button>
          </p>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="E-mail">
            {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}
          </Field>
          <Field label="Mot de passe" hint={mode !== 'login' ? '8 caractères minimum.' : undefined}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          {mode !== 'login' && (
            <Field label="Confirmer le mot de passe">
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
            </Field>
          )}
          {error && (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
          {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </Button>
        </form>

        {hasAdmin && (
          <p className="mt-5 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setMode('signup')}>
                  Créer un compte
                </button>
              </>
            ) : (
              <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setMode('login')}>
                J’ai déjà un compte
              </button>
            )}
          </p>
        )}
      </Card>
      <Link to="/" className="mt-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Retour au site
      </Link>
    </div>
  )
}
