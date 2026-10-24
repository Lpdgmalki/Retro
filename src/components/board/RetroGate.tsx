import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, RefreshCw, SearchX, UserPlus, WifiOff } from 'lucide-react'
import { Button, EmptyState, PageLoader } from '../ui/primitives'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import type { Board } from '../../hooks/useRetroBoard'

/** Gère chargement, erreurs, accès refusé et lecture seule avant d'afficher une page de rétro. */
export function RetroGate({ board, children }: { board: Board; children: ReactNode }) {
  if (board.loading) return <PageLoader label="Chargement de la rétrospective…" />
  if (board.error && !board.retro) {
    return (
      <EmptyState
        className="min-h-[50vh]"
        icon={<WifiOff className="size-10" />}
        title="Impossible de charger la rétrospective"
        description={board.error}
        action={
          <Button variant="secondary" onClick={board.reload}>
            <RefreshCw className="size-4" /> Réessayer
          </Button>
        }
      />
    )
  }
  if (board.notFound || !board.retro) {
    return (
      <EmptyState
        className="min-h-[50vh]"
        icon={<SearchX className="size-10" />}
        title="Rétrospective introuvable ou accès refusé"
        description="Elle a peut-être été supprimée, ou vous n’y avez pas encore accès. Demandez le lien de partage au facilitateur."
        action={
          <Link to="/">
            <Button variant="secondary">Retour à l’accueil</Button>
          </Link>
        }
      />
    )
  }
  return <>{children}</>
}

/** Bandeau affiché aux membres de l'équipe qui consultent sans être participants. */
export function ReadOnlyBanner({ board }: { board: Board }) {
  const { displayName } = useAuth()
  const toast = useToast()
  const [joining, setJoining] = useState(false)
  if (board.me) return null
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2">
        <Lock className="size-4 shrink-0" /> Lecture seule : vous consultez l’historique de votre équipe.
      </p>
      <Button
        size="sm"
        variant="secondary"
        loading={joining}
        onClick={async () => {
          setJoining(true)
          const { error } = await supabase.rpc('join_retro', {
            p_token: board.retro!.share_token,
            p_display_name: displayName || 'Participant',
          })
          setJoining(false)
          if (error) toast.error(error)
          else board.reload()
        }}
      >
        <UserPlus className="size-4" /> Participer
      </Button>
    </div>
  )
}
