import { Link, Outlet, useLocation } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { Avatar, cx } from '../ui/primitives'
import { openAccess } from '../landing/Landing'
import { Menu } from '../ui/Menu'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { memberDisplayName } from '../../lib/members'

export function BrandMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <rect x="7" y="8" width="7" height="7" rx="2" fill="#86efac" />
      <rect x="18" y="8" width="7" height="7" rx="2" fill="#fda4af" />
      <rect x="7" y="18" width="7" height="7" rx="2" fill="#93c5fd" />
      <rect x="18" y="18" width="7" height="7" rx="2" fill="#d8b4fe" />
    </svg>
  )
}

/** Mise en page du site vitrine (invités) : en-tête sobre, lien discret vers le back office. */
export function GuestShell() {
  const { member, forgetIdentity, isAdmin } = useAuth()
  const { settings } = useSettings()
  const isHome = useLocation().pathname === '/'

  return (
    <div className={cx('flex min-h-screen flex-col', isHome && 'theme-light')}>
      <header className={cx('sticky top-0 z-30 bg-surface/85 backdrop-blur print:hidden', isHome ? 'border-b border-transparent' : 'border-b border-slate-200/80')}>
        <div className={cx('mx-auto flex max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8', isHome ? 'h-20' : 'h-14')}>
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <BrandMark />
            <span className={cx('tracking-tight', isHome ? 'text-xl font-extrabold uppercase' : 'text-[15px]')}>{settings.org_name}</span>
          </Link>
          {isHome && (
            <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Sections">
              {[
                ['#fonctionnement', 'Fonctionnement'],
                ['#avantages', 'Avantages'],
                ['#faq', 'FAQ'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="rounded-lg px-3.5 py-1.5 text-[17px] font-semibold text-slate-500 transition hover:text-slate-900">
                  {label}
                </a>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isHome && !member && (
              <button type="button" onClick={openAccess} className="btn-glow inline-flex h-11 items-center rounded-xl px-5 text-[15px] font-bold text-white">
                Connexion
              </button>
            )}
            {isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
                <ShieldCheck className="size-4" /> Back office
              </Link>
            )}
            {member && (
              <Menu
                label="Mon identité"
                items={[{ label: 'Changer d’identité', icon: <LogOut className="size-4" />, onSelect: () => forgetIdentity() }]}
                trigger={(p) => (
                  <button {...p} className="flex items-center gap-2 rounded-full py-0.5 pr-3 pl-0.5 hover:bg-slate-100">
                    <Avatar name={memberDisplayName(member)} seed={member.id} src={member.photo_url} />
                    <span className="hidden text-left sm:block">
                      <span className="block text-sm leading-tight font-medium text-slate-800">{memberDisplayName(member)}</span>
                      {member.job_title && <span className="block text-xs leading-tight text-slate-500">{member.job_title}</span>}
                    </span>
                  </button>
                )}
              />
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200/70 py-8 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-6" />
            <span className="font-semibold text-slate-800">{settings.org_name}</span>
            <span className="text-slate-400">· © {new Date().getFullYear()}</span>
          </div>
          {/* Accès discret au back office */}
          <Link to="/admin" className="text-slate-300 transition hover:text-slate-500" aria-label="Accès back office">
            Back office
          </Link>
        </div>
      </footer>
    </div>
  )
}
