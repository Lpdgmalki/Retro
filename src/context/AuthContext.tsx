import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { memberDisplayName } from '../lib/members'
import type { MemberProfile } from '../lib/types'

const NAME_KEY = 'retro.displayName'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  /** Nom affiché : identité annuaire, sinon pseudo mémorisé. */
  displayName: string
  isAnonymous: boolean
  /** Administrateur du back office. */
  isAdmin: boolean
  /** Fiche annuaire associée à ce navigateur (invité identifié). */
  member: MemberProfile | null
  rolesLoading: boolean
  setDisplayName: (name: string) => void
  identify: (email: string) => Promise<MemberProfile>
  forgetIdentity: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Crée un compte e-mail ; renvoie true si une confirmation par e-mail est nécessaire. */
  signUpWithPassword: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  refreshRoles: () => Promise<void>
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
  const [storedName, setStoredName] = useState(readStoredName)
  const [attempt, setAttempt] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [member, setMember] = useState<MemberProfile | null>(null)
  const [rolesLoading, setRolesLoading] = useState(true)

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

  const refreshRoles = useCallback(async () => {
    setRolesLoading(true)
    const [admin, me] = await Promise.all([supabase.rpc('is_admin'), supabase.rpc('my_member')])
    setIsAdmin(Boolean(admin.data))
    setMember(((me.data as MemberProfile[] | null) ?? [])[0] ?? null)
    setRolesLoading(false)
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (userId) refreshRoles()
  }, [userId, refreshRoles])

  const setDisplayName = useCallback((name: string) => {
    const clean = name.trim()
    setStoredName(clean)
    try {
      localStorage.setItem(NAME_KEY, clean)
    } catch {
      /* stockage indisponible : le nom reste en mémoire */
    }
  }, [])

  const identify = useCallback(async (email: string) => {
    const { data, error: err } = await supabase.rpc('identify_member', { p_email: email })
    if (err) throw err
    const m = data as MemberProfile
    setMember(m)
    return m
  }, [])

  const forgetIdentity = useCallback(async () => {
    await supabase.rpc('forget_identity')
    setMember(null)
  }, [])

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      await refreshRoles()
    },
    [refreshRoles],
  )

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin/login` },
      })
      if (err) throw err
      if (data.session) await refreshRoles()
      return !data.session
    },
    [refreshRoles],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    setMember(null)
    setAttempt((a) => a + 1)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      displayName: member ? memberDisplayName(member) : storedName,
      isAnonymous: Boolean(user?.is_anonymous),
      isAdmin,
      member,
      rolesLoading,
      setDisplayName,
      identify,
      forgetIdentity,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshRoles,
      retry: () => setAttempt((a) => a + 1),
    }),
    [user, loading, error, member, storedName, isAdmin, rolesLoading, setDisplayName, identify, forgetIdentity, signInWithPassword, signUpWithPassword, signOut, refreshRoles],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}

/** Page d'accueil selon le profil : back office pour les administrateurs, vitrine sinon. */
export function useHomePath(): string {
  return useAuth().isAdmin ? '/admin' : '/'
}
