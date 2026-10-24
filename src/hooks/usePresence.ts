import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Présence en ligne via un canal Realtime privé (« retro:<id> »), autorisé par RLS
 * uniquement pour les participants. Si la présence échoue, le tableau reste fonctionnel.
 */
export function usePresence(retroId: string | undefined, userId: string | undefined, enabled: boolean) {
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!retroId || !userId || !enabled) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) await supabase.realtime.setAuth(data.session.access_token)
      if (cancelled) return
      channel = supabase.channel(`retro:${retroId}`, {
        config: { private: true, presence: { key: userId } },
      })
      channel
        .on('presence', { event: 'sync' }, () => {
          setOnline(new Set(Object.keys(channel!.presenceState())))
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel!.track({ online_at: new Date().toISOString() })
          }
        })
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [retroId, userId, enabled])

  return online
}
