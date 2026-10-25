import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Clock, Crown, Wifi, WifiOff } from 'lucide-react'
import { Avatar, Badge, cx } from '../ui/primitives'
import { STATUS_BADGE, STATUS_LABEL } from '../../lib/constants'
import { formatDate, formatDateTime } from '../../lib/format'
import type { Board } from '../../hooks/useRetroBoard'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'

export function RetroHeader({
  board,
  online,
  onParticipants,
  actions,
  section,
}: {
  board: Board
  online: Set<string>
  onParticipants: () => void
  actions: ReactNode
  section?: string
}) {
  const { isAdmin } = useAuth()
  const retro = board.retro!
  const shown = [...board.participants]
    .sort((a, b) => Number(online.has(b.user_id)) - Number(online.has(a.user_id)))
    .slice(0, 5)
  const extra = board.participants.length - shown.length

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <nav className="flex items-center gap-1 text-xs text-slate-500" aria-label="Fil d’Ariane">
          <Link to={isAdmin ? '/admin/retros' : '/'} className="hover:text-slate-800">
            {retro.teams?.name ?? 'Équipe'}
          </Link>
          <ChevronRight className="size-3" />
          {section ? (
            <>
              <Link to={`/r/${retro.id}`} className="hover:text-slate-800">
                {retro.sprint_name}
              </Link>
              <ChevronRight className="size-3" />
              <span className="text-slate-700">{section}</span>
            </>
          ) : (
            <span className="text-slate-700">Tableau</span>
          )}
        </nav>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 sm:text-4xl">{retro.sprint_name}</h1>
          <Badge className={STATUS_BADGE[retro.status]}>{STATUS_LABEL[retro.status]}</Badge>
          <span
            className={cx('inline-flex items-center gap-1 text-xs', board.connection === 'live' ? 'text-emerald-600' : 'text-slate-400')}
            title={board.connection === 'live' ? 'Synchronisation temps réel active' : 'Reconnexion en cours…'}
          >
            {board.connection === 'live' ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            <span className="hidden sm:inline">{board.connection === 'live' ? 'En direct' : 'Reconnexion…'}</span>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" /> {formatDate(retro.retro_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Crown className="size-3.5" /> {retro.facilitator_name}
          </span>
          {retro.closes_at && (
            <span className={cx('inline-flex items-center gap-1', board.closesPassed && 'font-medium text-rose-600')}>
              <Clock className="size-3.5" /> {board.closesPassed ? 'Clôturée le' : 'Clôture'} {formatDateTime(retro.closes_at)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onParticipants}
          className="mr-1 flex items-center rounded-full py-0.5 pr-2 pl-0.5 hover:bg-slate-100"
          aria-label={`Voir les ${board.participants.length} participants`}
        >
          <div className="flex -space-x-2">
            {shown.map((p) => (
              <span key={p.user_id} className="relative">
                <Avatar name={p.display_name} seed={p.user_id} src={p.photo_url} className="ring-2 ring-surface" />
                {online.has(p.user_id) && (
                  <span className="absolute right-0 bottom-0 size-2 rounded-full bg-emerald-500 ring-2 ring-surface" />
                )}
              </span>
            ))}
          </div>
          {extra > 0 && <span className="ml-1.5 text-xs font-medium text-slate-500">+{extra}</span>}
        </button>
        {actions}
      </div>
    </div>
  )
}
