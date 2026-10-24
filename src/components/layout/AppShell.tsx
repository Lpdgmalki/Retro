import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { CheckSquare, History, LayoutDashboard, LogIn, LogOut, Mail, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { Avatar, Button, Field, Input, cx } from '../ui/primitives'
import { Menu } from '../ui/Menu'
import { Modal } from '../ui/Modal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { LIMITS } from '../../lib/constants'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2 font-semibold text-slate-900', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#4f46e5" />
        <rect x="7" y="8" width="7" height="7" rx="2" fill="#86efac" />
        <rect x="18" y="8" width="7" height="7" rx="2" fill="#fda4af" />
        <rect x="7" y="18" width="7" height="7" rx="2" fill="#93c5fd" />
        <rect x="18" y="18" width="7" height="7" rx="2" fill="#d8b4fe" />
      </svg>
      <span className="text-[15px] tracking-tight">Rétro Sprint</span>
    </Link>
  )
}

const NAV = [
  { to: '/', label: 'Accueil', icon: LayoutDashboard, end: true },
  { to: '/retros', label: 'Rétrospectives', icon: History, end: false },
  { to: '/actions', label: 'Actions', icon: CheckSquare, end: false },
]

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900',
                  )
                }
              >
                <n.icon className="size-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/new">
              <Button size="sm">
                <Plus className="size-4" /> <span className="hidden sm:inline">Nouvelle rétro</span>
              </Button>
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">{children ?? <Outlet />}</main>
      {/* Navigation mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden print:hidden"
        aria-label="Navigation mobile"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-indigo-600' : 'text-slate-500')
            }
          >
            <n.icon className="size-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function AccountMenu() {
  const { user, displayName, isAnonymous, signOut } = useAuth()
  const [dialog, setDialog] = useState<'name' | 'link' | 'login' | null>(null)
  const name = displayName || 'Invité'
  return (
    <>
      <Menu
        label="Mon compte"
        items={[
          { label: `Pseudo : ${name}`, icon: <UserRound className="size-4" />, onSelect: () => setDialog('name') },
          ...(isAnonymous
            ? [
                { label: 'Sécuriser avec mon e-mail', icon: <ShieldCheck className="size-4" />, onSelect: () => setDialog('link') },
                { label: 'Se connecter par e-mail', icon: <LogIn className="size-4" />, onSelect: () => setDialog('login') },
              ]
            : [{ label: user?.email ?? 'Compte e-mail', icon: <Mail className="size-4" />, onSelect: () => {}, disabled: true }]),
          ...(!isAnonymous ? [{ label: 'Se déconnecter', icon: <LogOut className="size-4" />, onSelect: () => signOut() }] : []),
        ]}
        trigger={(p) => (
          <button {...p} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none">
            <Avatar name={name} seed={user?.id ?? name} />
          </button>
        )}
      />
      <NameDialog open={dialog === 'name'} onClose={() => setDialog(null)} />
      <EmailDialog mode="link" open={dialog === 'link'} onClose={() => setDialog(null)} />
      <EmailDialog mode="login" open={dialog === 'login'} onClose={() => setDialog(null)} />
    </>
  )
}

function NameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { displayName, setDisplayName } = useAuth()
  const [value, setValue] = useState(displayName)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mon pseudo par défaut"
      description="Utilisé lorsque vous rejoignez une nouvelle rétrospective."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              const v = value.trim()
              if (!v || v.length > LIMITS.displayName) return setError(`Entre 1 et ${LIMITS.displayName} caractères.`)
              setDisplayName(v)
              onClose()
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Pseudo" error={error}>
        {(id) => <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} data-autofocus />}
      </Field>
    </Modal>
  )
}

function EmailDialog({ mode, open, onClose }: { mode: 'link' | 'login'; open: boolean; onClose: () => void }) {
  const { linkEmail, signInWithEmail } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function send() {
    if (!valid) return
    setSending(true)
    try {
      if (mode === 'link') await linkEmail(email)
      else await signInWithEmail(email)
      setSent(true)
    } catch (e) {
      toast.error(e)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setSent(false)
        onClose()
      }}
      title={mode === 'link' ? 'Sécuriser mon accès' : 'Connexion par e-mail'}
      description={
        mode === 'link'
          ? 'Associez un e-mail à votre identité actuelle pour retrouver vos rétrospectives sur un autre appareil.'
          : 'Recevez un lien de connexion sécurisé (sans mot de passe).'
      }
      size="sm"
      footer={
        sent ? (
          <Button onClick={onClose}>Fermer</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={send} loading={sending} disabled={!valid}>
              Envoyer le lien
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <p className="text-sm text-slate-600">
          Un e-mail a été envoyé à <strong>{email}</strong>. Cliquez sur le lien qu’il contient pour terminer.
        </p>
      ) : (
        <>
          <Field label="Adresse e-mail professionnelle">
            {(id) => (
              <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@entreprise.com" data-autofocus onKeyDown={(e) => e.key === 'Enter' && send()} />
            )}
          </Field>
          {mode === 'login' && (
            <p className="mt-3 text-xs text-slate-500">
              Attention : se connecter à un autre compte remplace votre identité invitée actuelle sur ce navigateur. Pour la conserver,
              utilisez plutôt « Sécuriser avec mon e-mail ».
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
