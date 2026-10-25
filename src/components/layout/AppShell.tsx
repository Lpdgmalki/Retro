import { Link, NavLink, Outlet } from 'react-router-dom'
import { CheckSquare, ExternalLink, History, LayoutDashboard, LogOut, Plus, Settings, Users } from 'lucide-react'
import { Avatar, Button, cx } from '../ui/primitives'
import { Menu } from '../ui/Menu'
import { BrandMark } from './GuestShell'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'

export function Logo({ className, to = '/admin' }: { className?: string; to?: string }) {
  const { settings } = useSettings()
  return (
    <Link to={to} className={cx('flex items-center gap-2 font-semibold text-slate-900', className)}>
      <BrandMark />
      <span className="text-[15px] tracking-tight">{settings.org_name}</span>
    </Link>
  )
}

const NAV = [
  { to: '/admin', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard, end: true },
  { to: '/admin/retros', label: 'Rétrospectives', short: 'Rétros', icon: History, end: false },
  { to: '/admin/members', label: 'Annuaire', short: 'Annuaire', icon: Users, end: false },
  { to: '/admin/actions', label: 'Actions', short: 'Actions', icon: CheckSquare, end: false },
  { to: '/admin/settings', label: 'Paramètres', short: 'Réglages', icon: Settings, end: false },
]

/** Mise en page du back office (administrateurs). */
export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <span className="hidden rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase sm:inline">
            Back office
          </span>
          <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Navigation principale">
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
            <Link to="/admin/new">
              <Button size="sm">
                <Plus className="size-4" /> <span className="hidden sm:inline">Nouvelle rétro</span>
              </Button>
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-20 lg:pb-0">
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden print:hidden"
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
            {n.short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function AccountMenu() {
  const { user, signOut } = useAuth()
  const email = user?.email ?? 'Administrateur'
  return (
    <Menu
      label="Mon compte"
      items={[
        { label: 'Voir le site vitrine', icon: <ExternalLink className="size-4" />, onSelect: () => window.open('/', '_blank') },
        { label: 'Se déconnecter', icon: <LogOut className="size-4" />, onSelect: () => signOut() },
      ]}
      trigger={(p) => (
        <button {...p} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none" title={email}>
          <Avatar name={email} seed={user?.id ?? email} />
        </button>
      )}
    />
  )
}
