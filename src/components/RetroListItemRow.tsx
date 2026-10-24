import { Link } from 'react-router-dom'
import { CalendarDays, Copy, Crown, StickyNote, Users } from 'lucide-react'
import { Badge, Button } from './ui/primitives'
import { STATUS_BADGE, STATUS_LABEL } from '../lib/constants'
import { formatDate } from '../lib/format'
import type { RetroListItem } from '../hooks/useMyRetros'

export function RetroRow({ retro, onDuplicate }: { retro: RetroListItem; onDuplicate?: (r: RetroListItem) => void }) {
  return (
    <li className="group relative flex flex-col gap-2 px-4 py-3.5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link to={`/r/${retro.id}`} className="truncate text-sm font-semibold text-slate-900 after:absolute after:inset-0 hover:text-indigo-700">
            {retro.sprint_name}
          </Link>
          <Badge className={STATUS_BADGE[retro.status]}>{STATUS_LABEL[retro.status]}</Badge>
          {retro.myRole === 'facilitator' && (
            <span title="Vous êtes facilitateur" className="text-amber-500">
              <Crown className="size-3.5" />
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="font-medium text-slate-600">{retro.teams?.name}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" /> {formatDate(retro.retro_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {retro.participants?.[0]?.count ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <StickyNote className="size-3" /> {retro.cards?.[0]?.count ?? 0} cartes
          </span>
        </div>
      </div>
      {onDuplicate && (
        <Button
          variant="ghost"
          size="sm"
          className="relative z-10 self-start opacity-100 sm:self-auto sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          onClick={() => onDuplicate(retro)}
          title="Créer une nouvelle rétro avec les mêmes paramètres"
        >
          <Copy className="size-3.5" /> Dupliquer
        </Button>
      )}
    </li>
  )
}
