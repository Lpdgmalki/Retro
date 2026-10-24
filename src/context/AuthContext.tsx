import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'

const NAME_KEY = 'retro.displayName'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  displayName: string
  isAnonymous: boolean
  setDisplayName: (name: string) => void
  /** Envoie un lien magique de connexion (compte existant ou nouveau). */
  signInWithEmail: (email: string) => Promise<void>
  /** Associe un e-mail à l'identité invitée actuelle (conserve l'historique). */
  linkEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayName, setDisplayNameState] = useState(readStoredName)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await supabase.auth.getSession()
        let current = data.session?.user ?? null
        if (!current) {
          // Accès invité sécurisé : identité Supabase réelle (JWT), persistée dans le navigateur.
          const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously()
          if (anonErr) throw anonErr
          current = anon.user
        }
        if (!cancelled) setUser(current)
      } catch (e) {
        if (!cancelled) setError(errorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    ensureSession()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [attempt])

  // Récupère le nom enregistré dans le profil si le navigateur n'en a pas.
  useEffect(() => {
    const metaName = (user?.user_metadata?.display_name as string | undefined) ?? ''
    if (!displayName && metaName) setDisplayNameState(metaName)
  }, [user, displayName])

  const setDisplayName = useCallback((name: string) => {
    const clean = name.trim()
    setDisplayNameState(clean)
    try {
      localStorage.setItem(NAME_KEY, clean)
    } catch {
      /* stockage indisponible : le nom reste en mémoire */
    }
    supabase.auth.updateUser({ data: { display_name: clean } }).catch(() => {})
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (err) throw err
  }, [])

  const linkEmail = useCallback(async (email: string) => {
    const { error: err } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: window.location.origin + window.location.pathname },
    )
    if (err) throw err
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAttempt((a) => a + 1)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      displayName,
      isAnonymous: Boolean(user?.is_anonymous),
      setDisplayName,
      signInWithEmail,
      linkEmail,
      signOut,
      retry: () => setAttempt((a) => a + 1),
    }),
    [user, loading, error, displayName, setDisplayName, signInWithEmail, linkEmail, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
