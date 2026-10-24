import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import type { RetroWithTeam, Team } from '../lib/types'

export interface RetroListItem extends RetroWithTeam {
  participants: { count: number }[]
  cards: { count: number }[]
  myRole: 'facilitator' | 'participant' | null
}

/** Rétrospectives accessibles (participations + historique des équipes). */
export function useMyRetros(userId: string | undefined) {
  const [retros, setRetros] = useState<RetroListItem[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const [r, mine, t] = await Promise.all([
        supabase
          .from('retros')
          .select('*, teams(id, name), participants(count), cards(count)')
          .order('retro_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(300),
        supabase.from('participants').select('retro_id, role').eq('user_id', userId),
        supabase.from('teams').select('*').order('name'),
      ])
      if (cancelled) return
      const err = r.error ?? mine.error ?? t.error
      if (err) {
        setError(errorMessage(err))
      } else {
        const roles = new Map((mine.data ?? []).map((p) => [p.retro_id as string, p.role as RetroListItem['myRole']]))
        setRetros((r.data as RetroListItem[]).map((x) => ({ ...x, myRole: roles.get(x.id) ?? null })))
        setTeams(t.data as Team[])
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, version])

  // Rafraîchit la liste quand une rétro visible change (statut, nom…).
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`my-retros-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retros' }, () => reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, reload])

  return { retros, teams, loading, error, reload }
}
