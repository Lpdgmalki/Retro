import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { AppSettings } from '../lib/types'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  org_name: 'Rétro Sprint',
  welcome_title: 'Bienvenue dans nos rétrospectives',
  welcome_message: 'Identifiez-vous avec votre adresse e-mail professionnelle pour rejoindre les rétrospectives de votre équipe.',
  email_suggestions: true,
  allow_external_guests: false,
  default_max_votes: 5,
  default_allow_multiple_votes: false,
  default_confidential_votes: false,
  default_allow_anonymous: true,
  default_participants_can_add: true,
  updated_at: '',
}

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  update: (patch: Partial<AppSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsState | null>(null)

/** Paramètres globaux de l'application (réglés dans le back office). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as AppSettings)
        setLoaded(true)
      })
  }, [user])

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const { id: _id, updated_at: _u, ...clean } = patch
    const { data, error } = await supabase.from('app_settings').update(clean).eq('id', 1).select().single()
    if (error) throw error
    setSettings(data as AppSettings)
  }, [])

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings doit être utilisé dans <SettingsProvider>')
  return ctx
}
