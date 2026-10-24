interface MaybePgError {
  message?: string
  code?: string
  details?: string
}

/** Transforme une erreur Supabase/PostgREST en message lisible en français. */
export function errorMessage(err: unknown): string {
  if (!err) return 'Une erreur inconnue est survenue.'
  const e = err as MaybePgError
  const msg = e.message ?? String(err)

  if (e.code === '42501' && /row-level security/i.test(msg)) {
    return 'Action non autorisée : vous n’avez pas les droits nécessaires ou la session est fermée.'
  }
  if (e.code === '23514') return 'Les données saisies ne respectent pas les contraintes (longueur, format).'
  if (e.code === 'PGRST116') return 'Élément introuvable ou inaccessible.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.'
  }
  if (/Anonymous sign-ins are disabled/i.test(msg)) {
    return 'L’accès invité est désactivé sur le serveur (activez « Anonymous sign-ins » dans Supabase).'
  }
  return msg
}
