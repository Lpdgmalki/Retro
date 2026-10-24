import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import type { ActionItem, ActionItemWithRetro } from '../lib/types'

/**
 * Actions visibles par l'utilisateur (toutes équipes, ou une équipe donnée),
 * avec la rétrospective d'origine et mise à jour en temps réel.
 */
export function useActionsList(teamId?: string | null, enabled = true) {
  const [actions, setActions] = useState<ActionItemWithRetro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!enabled || teamId === null) return
    let cancelled = false
    let q = supabase
      .from('action_items')
      .select('*, retros(id, sprint_name, retro_date, teams(id, name))')
      .order('created_at', { ascending: false })
      .limit(500)
    if (teamId) q = q.eq('team_id', teamId)
    q.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(errorMessage(err))
      else {
        setActions(data as ActionItemWithRetro[])
        setError(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [teamId, enabled, version])

  useEffect(() => {
    if (!enabled || teamId === null) return
    const channel = supabase
      .channel(`actions-${teamId ?? 'all'}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'action_items', ...(teamId ? { filter: `team_id=eq.${teamId}` } : {}) },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            setActions((list) => list.filter((a) => a.id !== id))
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as ActionItem
            setActions((list) => list.map((a) => (a.id === row.id ? { ...a, ...row } : a)))
          } else {
            reload()
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [teamId, enabled, reload])

  const update = useCallback(async (id: string, patch: Partial<ActionItem>) => {
    const { data, error: err } = await supabase.from('action_items').update(patch).eq('id', id).select().single()
    if (err) throw err
    setActions((list) => list.map((a) => (a.id === id ? { ...a, ...(data as ActionItem) } : a)))
  }, [])

  return { actions, loading, error, reload, update }
}
