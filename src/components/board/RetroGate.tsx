import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { Button, EmptyState, PageLoader } from '../ui/primitives'
import { useHomePath } from '../../context/AuthContext'
import type { Board } from '../../hooks/useRetroBoard'

/** Gère chargement, erreurs, accès refusé et lecture seule avant d'afficher une page de rétro. */
export function RetroGate({ board, children }: { board: Board; children: ReactNode }) {
  const home = useHomePath()
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
        description="Elle a peut-être été supprimée, ou vous n’y avez pas encore accès. Identifiez-vous sur l’accueil ou demandez le lien d’invitation au facilitateur."
        action={
          <Link to={home}>
            <Button variant="secondary">Retour à l’accueil</Button>
          </Link>
        }
      />
    )
  }
  return <>{children}</>
}
