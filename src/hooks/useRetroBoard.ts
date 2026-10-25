import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import type { ActionItem, Card, CardCategory, Comment, Participant, RetroWithTeam, Vote } from '../lib/types'

export type ConnectionState = 'connecting' | 'live' | 'offline'

interface BoardData {
  retro: RetroWithTeam | null
  participants: Participant[]
  cards: Card[]
  comments: Comment[]
  votes: Vote[]
  actions: ActionItem[]
  ownedCardIds: Set<string>
  totals: Map<string, number> | null
  usage: Map<string, number>
}

type Action =
  | { type: 'load'; data: BoardData }
  | { type: 'retro'; retro: Partial<RetroWithTeam> }
  | { type: 'upsert'; table: 'participants' | 'cards' | 'comments' | 'votes' | 'actions'; row: any }
  | { type: 'remove'; table: 'participants' | 'cards' | 'comments' | 'votes' | 'actions'; match: (row: any) => boolean }
  | { type: 'own'; cardId: string }
  | { type: 'totals'; totals: Map<string, number> | null }
  | { type: 'usage'; usage: Map<string, number> }

const EMPTY: BoardData = {
  retro: null,
  participants: [],
  cards: [],
  comments: [],
  votes: [],
  actions: [],
  ownedCardIds: new Set(),
  totals: null,
  usage: new Map(),
}

function keyOf(table: string, row: any): string {
  return table === 'participants' ? `${row.retro_id}:${row.user_id}` : row.id
}

function reducer(state: BoardData, action: Action): BoardData {
  switch (action.type) {
    case 'load':
      return action.data
    case 'retro':
      return state.retro ? { ...state, retro: { ...state.retro, ...action.retro } } : state
    case 'upsert': {
      const list = state[action.table] as any[]
      const k = keyOf(action.table, action.row)
      const idx = list.findIndex((r) => keyOf(action.table, r) === k)
      if (idx === -1) return { ...state, [action.table]: [...list, action.row] }
      // Ignore les événements plus anciens que l'état local (ordre non garanti).
      const current = list[idx]
      if (current.updated_at && action.row.updated_at && current.updated_at > action.row.updated_at) return state
      const next = list.slice()
      next[idx] = { ...current, ...action.row }
      return { ...state, [action.table]: next }
    }
    case 'remove': {
      const list = state[action.table] as any[]
      const next = list.filter((r) => !action.match(r))
      if (next.length === list.length) return state
      const patch: Partial<BoardData> = { [action.table]: next }
      if (action.table === 'cards') {
        const removed = new Set(list.filter(action.match).map((c: Card) => c.id))
        patch.comments = state.comments.filter((c) => !removed.has(c.card_id))
        patch.votes = state.votes.filter((v) => !removed.has(v.card_id))
      }
      if (action.table === 'comments') {
        // Les réponses d'un commentaire supprimé disparaissent avec lui (ON DELETE CASCADE).
        const removedIds = new Set(list.filter(action.match).map((c: Comment) => c.id))
        let grew = true
        let remaining = next as Comment[]
        while (grew) {
          const before = remaining.length
          remaining = remaining.filter((c) => {
            if (c.parent_id && removedIds.has(c.parent_id)) {
              removedIds.add(c.id)
              return false
            }
            return true
          })
          grew = remaining.length !== before
        }
        patch.comments = remaining
      }
      return { ...state, ...patch }
    }
    case 'own': {
      const owned = new Set(state.ownedCardIds)
      owned.add(action.cardId)
      return { ...state, ownedCardIds: owned }
    }
    case 'totals':
      return { ...state, totals: action.totals }
    case 'usage':
      return { ...state, usage: action.usage }
  }
}

async function fetchBoard(retroId: string): Promise<BoardData | null> {
  const retroRes = await supabase.from('retros').select('*, teams(id, name)').eq('id', retroId).maybeSingle()
  if (retroRes.error) throw retroRes.error
  if (!retroRes.data) return null
  const retro = retroRes.data as RetroWithTeam

  const [participants, cards, comments, votes, actions, owners, usage] = await Promise.all([
    supabase.from('participants').select('*').eq('retro_id', retroId).order('joined_at'),
    supabase.from('cards').select('*').eq('retro_id', retroId).order('created_at'),
    supabase.from('comments').select('*').eq('retro_id', retroId).order('created_at'),
    supabase.from('votes').select('*').eq('retro_id', retroId),
    supabase.from('action_items').select('*').eq('retro_id', retroId).order('created_at'),
    supabase.from('card_owners').select('card_id, cards!inner(retro_id)').eq('cards.retro_id', retroId),
    supabase.rpc('get_vote_usage', { p_retro_id: retroId }),
  ])
  for (const r of [participants, cards, comments, votes, actions, owners, usage]) {
    if (r.error) throw r.error
  }

  let totals: Map<string, number> | null = null
  if (retro.confidential_votes && retro.votes_revealed) totals = await fetchTotals(retroId)

  return {
    retro,
    participants: participants.data as Participant[],
    cards: cards.data as Card[],
    comments: comments.data as Comment[],
    votes: votes.data as Vote[],
    actions: actions.data as ActionItem[],
    ownedCardIds: new Set((owners.data as { card_id: string }[]).map((o) => o.card_id)),
    totals,
    usage: new Map((usage.data as { user_id: string; used: number }[]).map((u) => [u.user_id, Number(u.used)])),
  }
}

async function fetchTotals(retroId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_vote_totals', { p_retro_id: retroId })
  if (error) throw error
  return new Map((data as { card_id: string; votes: number }[]).map((t) => [t.card_id, Number(t.votes)]))
}

export interface CardDraft {
  category: CardCategory
  title: string
  description: string
  anonymous: boolean
}

export function useRetroBoard(retroId: string | undefined, userId: string | undefined, isAdmin = false) {
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [reloadKey, setReloadKey] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // Chargement initial (et après reconnexion).
  useEffect(() => {
    if (!retroId || !userId) return
    let cancelled = false
    ;(async () => {
      try {
        let data = await fetchBoard(retroId)
        // Un administrateur qui ouvre une rétro rejoint automatiquement la session comme facilitateur.
        if (data && isAdmin && !data.participants.some((p) => p.user_id === userId)) {
          const { error: joinErr } = await supabase.rpc('join_open_retro', { p_retro_id: retroId })
          if (!joinErr) data = await fetchBoard(retroId)
        }
        if (cancelled) return
        if (!data) {
          setNotFound(true)
        } else {
          setNotFound(false)
          dispatch({ type: 'load', data })
        }
        setError(null)
      } catch (e) {
        if (!cancelled) setError(errorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [retroId, userId, isAdmin, reloadKey])

  const refreshUsage = useCallback(async () => {
    if (!retroId) return
    const { data } = await supabase.rpc('get_vote_usage', { p_retro_id: retroId })
    if (data) dispatch({ type: 'usage', usage: new Map((data as any[]).map((u) => [u.user_id, Number(u.used)])) })
  }, [retroId])

  const usageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleUsage = useCallback(() => {
    if (usageTimer.current) clearTimeout(usageTimer.current)
    usageTimer.current = setTimeout(refreshUsage, 400)
  }, [refreshUsage])

  // Abonnements temps réel (Supabase Realtime, filtrés par RLS côté serveur).
  useEffect(() => {
    if (!retroId || !userId) return
    const filter = `retro_id=eq.${retroId}`
    const channel = supabase.channel(`board-${retroId}-${Math.random().toString(36).slice(2, 8)}`)

    const onRow =
      (table: 'participants' | 'cards' | 'comments' | 'votes' | 'actions') =>
      (payload: RealtimePostgresChangesPayload<any>) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as any
          if (table === 'participants') {
            dispatch({ type: 'remove', table, match: (r) => r.user_id === old.user_id && r.retro_id === old.retro_id })
            // Retiré par un facilitateur : on recharge pour refléter la perte d'accès.
            if (old.user_id === userId && old.retro_id === retroId) reload()
          } else if (old?.id) {
            dispatch({ type: 'remove', table, match: (r) => r.id === old.id })
          }
        } else {
          dispatch({ type: 'upsert', table, row: payload.new })
        }
        if (table === 'votes' || table === 'participants') scheduleUsage()
      }

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retros', filter: `id=eq.${retroId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setNotFound(true)
          return
        }
        const next = payload.new as RetroWithTeam
        const prev = stateRef.current.retro
        dispatch({ type: 'retro', retro: next })
        if (
          prev &&
          (prev.confidential_votes !== next.confidential_votes ||
            prev.votes_revealed !== next.votes_revealed ||
            prev.status !== next.status)
        ) {
          // La visibilité des votes a pu changer : on recharge votes et totaux.
          supabase
            .from('votes')
            .select('*')
            .eq('retro_id', retroId)
            .then(({ data }) => {
              if (!data) return
              const current = stateRef.current.votes
              current.forEach((v) => dispatch({ type: 'remove', table: 'votes', match: (r) => r.id === v.id }))
              data.forEach((row) => dispatch({ type: 'upsert', table: 'votes', row }))
            })
          if (next.confidential_votes && next.votes_revealed) {
            fetchTotals(retroId).then((t) => dispatch({ type: 'totals', totals: t })).catch(() => {})
          } else {
            dispatch({ type: 'totals', totals: null })
          }
          scheduleUsage()
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter }, onRow('participants'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'participants', filter }, onRow('participants'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'participants' }, onRow('participants'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards', filter }, onRow('cards'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards', filter }, onRow('cards'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cards' }, onRow('cards'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter }, onRow('comments'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments', filter }, onRow('comments'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, onRow('comments'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter }, onRow('votes'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'votes' }, onRow('votes'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'action_items', filter }, onRow('actions'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'action_items', filter }, onRow('actions'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'action_items' }, onRow('actions'))
      .on('system', {}, (payload: { extension?: string; status?: string }) => {
        // Le flux PostgreSQL est confirmé (au démarrage ou après une coupure) : on resynchronise
        // l'état complet pour ne manquer aucun changement survenu avant l'abonnement.
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') {
          setConnection('live')
          reload()
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [retroId, userId, reload, scheduleUsage])

  // Filet de sécurité : le temps réel peut manquer un événement (abonnement en cours
  // d'établissement, réseau mobile, mise en veille). On resynchronise donc régulièrement
  // tant que l'onglet est visible, et dès qu'il redevient actif.
  useEffect(() => {
    if (!retroId || !userId) return
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, 15000)
    function onVisible() {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [retroId, userId, reload])

  // En vote confidentiel, les votes des autres ne sont pas diffusés : on rafraîchit la participation.
  const confidentialVoting = state.retro?.status === 'voting' && state.retro.confidential_votes
  useEffect(() => {
    if (!confidentialVoting) return
    const t = setInterval(refreshUsage, 8000)
    return () => clearInterval(t)
  }, [confidentialVoting, refreshUsage])

  // ---------------------------------------------------------------------------
  // Données dérivées
  // ---------------------------------------------------------------------------
  const derived = useMemo(() => {
    const retro = state.retro
    const me = state.participants.find((p) => p.user_id === userId) ?? null
    // Seuls les administrateurs animent (règle appliquée aussi côté base).
    const isFacilitator = isAdmin && Boolean(me)
    const myVotes = new Map<string, number>()
    let myVotesUsed = 0
    for (const v of state.votes) {
      if (v.user_id === userId) {
        myVotes.set(v.card_id, (myVotes.get(v.card_id) ?? 0) + 1)
        myVotesUsed++
      }
    }

    // Totaux : visibles en direct hors mode confidentiel ; sinon après clôture du vote.
    let voteTotals: Map<string, number> | null
    if (retro?.confidential_votes) {
      voteTotals = retro.votes_revealed ? (state.totals ?? new Map()) : null
    } else {
      voteTotals = new Map()
      for (const v of state.votes) voteTotals.set(v.card_id, (voteTotals.get(v.card_id) ?? 0) + 1)
    }

    const votersByCard = new Map<string, string[]>()
    if (retro && !retro.confidential_votes) {
      for (const v of state.votes) {
        const arr = votersByCard.get(v.card_id) ?? []
        arr.push(v.user_id)
        votersByCard.set(v.card_id, arr)
      }
    }

    const nameOf = new Map(state.participants.map((p) => [p.user_id, p.display_name]))
    const photoOf = new Map(state.participants.filter((p) => p.photo_url).map((p) => [p.user_id, p.photo_url]))
    const commentCount = new Map<string, number>()
    for (const c of state.comments) {
      if (!c.is_deleted) commentCount.set(c.card_id, (commentCount.get(c.card_id) ?? 0) + 1)
    }

    const ranking = voteTotals
      ? state.cards
          .map((c) => ({ card: c, votes: voteTotals!.get(c.id) ?? 0 }))
          .filter((r) => r.votes > 0)
          .sort((a, b) => b.votes - a.votes || a.card.created_at.localeCompare(b.card.created_at))
      : []

    const closesPassed = Boolean(retro?.closes_at && new Date(retro.closes_at).getTime() <= Date.now())
    const canContribute =
      Boolean(me) &&
      Boolean(retro) &&
      ((retro!.status === 'open' && !closesPassed && retro!.participants_can_add) || (isFacilitator && retro!.status !== 'closed'))
    const canDiscuss = Boolean(me) && Boolean(retro) && ['open', 'voting'].includes(retro!.status) && !closesPassed
    const canVote = Boolean(me) && retro?.status === 'voting'

    return {
      me,
      isFacilitator,
      myVotes,
      myVotesUsed,
      votesRemaining: retro ? Math.max(0, retro.max_votes - myVotesUsed) : 0,
      voteTotals,
      votersByCard,
      nameOf,
      photoOf,
      commentCount,
      ranking,
      closesPassed,
      canContribute,
      canDiscuss,
      canVote,
    }
  }, [state, userId, isAdmin])

  // ---------------------------------------------------------------------------
  // Mutations (mise à jour locale immédiate à partir de la réponse serveur)
  // ---------------------------------------------------------------------------
  const mutations = useMemo(() => {
    if (!retroId) return null
    return {
      async createCard(draft: CardDraft) {
        const { data, error } = await supabase.rpc('create_card', {
          p_retro_id: retroId,
          p_category: draft.category,
          p_title: draft.title,
          p_description: draft.description,
          p_anonymous: draft.anonymous,
        })
        if (error) throw error
        dispatch({ type: 'upsert', table: 'cards', row: data })
        dispatch({ type: 'own', cardId: (data as Card).id })
        return data as Card
      },
      async updateCard(id: string, patch: Partial<Pick<Card, 'title' | 'description' | 'category'>>) {
        const { data, error } = await supabase.from('cards').update(patch).eq('id', id).select().single()
        if (error) throw error
        dispatch({ type: 'upsert', table: 'cards', row: data })
      },
      async deleteCard(id: string) {
        const { error, count } = await supabase.from('cards').delete({ count: 'exact' }).eq('id', id)
        if (error) throw error
        if (count === 0) throw new Error('Suppression impossible : la carte n’est plus modifiable.')
        dispatch({ type: 'remove', table: 'cards', match: (r) => r.id === id })
      },
      async addComment(cardId: string, body: string, parentId: string | null) {
        const { data, error } = await supabase
          .from('comments')
          .insert({ card_id: cardId, retro_id: retroId, body, parent_id: parentId })
          .select()
          .single()
        if (error) throw error
        dispatch({ type: 'upsert', table: 'comments', row: data })
      },
      async updateComment(id: string, body: string) {
        const { data, error } = await supabase.from('comments').update({ body }).eq('id', id).select().single()
        if (error) throw error
        dispatch({ type: 'upsert', table: 'comments', row: data })
      },
      async deleteComment(id: string) {
        const { error } = await supabase.from('comments').delete().eq('id', id)
        if (error) throw error
        // Suppression douce si le commentaire a des réponses : on relit la ligne.
        const { data } = await supabase.from('comments').select('*').eq('id', id).maybeSingle()
        if (data) dispatch({ type: 'upsert', table: 'comments', row: data })
        else dispatch({ type: 'remove', table: 'comments', match: (r) => r.id === id })
      },
      async vote(cardId: string) {
        const { data, error } = await supabase.rpc('cast_vote', { p_card_id: cardId })
        if (error) throw error
        dispatch({ type: 'upsert', table: 'votes', row: data })
        scheduleUsage()
      },
      async unvote(cardId: string) {
        const { data, error } = await supabase.rpc('remove_vote', { p_card_id: cardId })
        if (error) throw error
        dispatch({ type: 'remove', table: 'votes', match: (r) => r.id === data })
        scheduleUsage()
      },
      async updateRetro(patch: Partial<RetroWithTeam>) {
        const { teams: _t, ...clean } = patch as any
        const { data, error } = await supabase.from('retros').update(clean).eq('id', retroId).select().single()
        if (error) throw error
        dispatch({ type: 'retro', retro: data })
        if ((data as RetroWithTeam).confidential_votes && (data as RetroWithTeam).votes_revealed) {
          dispatch({ type: 'totals', totals: await fetchTotals(retroId) })
        }
      },
      async renameMe(name: string) {
        const { data, error } = await supabase
          .from('participants')
          .update({ display_name: name })
          .eq('retro_id', retroId)
          .eq('user_id', userId!)
          .select()
          .single()
        if (error) throw error
        dispatch({ type: 'upsert', table: 'participants', row: data })
      },
      async removeParticipant(userIdToRemove: string) {
        const { error } = await supabase
          .from('participants')
          .delete()
          .eq('retro_id', retroId)
          .eq('user_id', userIdToRemove)
        if (error) throw error
        dispatch({ type: 'remove', table: 'participants', match: (r) => r.user_id === userIdToRemove })
      },
      async createAction(input: Partial<ActionItem> & { title: string }) {
        const { data, error } = await supabase
          .from('action_items')
          .insert({ ...input, retro_id: retroId, team_id: stateRef.current.retro?.team_id })
          .select()
          .single()
        if (error) throw error
        dispatch({ type: 'upsert', table: 'actions', row: data })
        return data as ActionItem
      },
      async updateAction(id: string, patch: Partial<ActionItem>) {
        const { data, error } = await supabase.from('action_items').update(patch).eq('id', id).select().single()
        if (error) throw error
        dispatch({ type: 'upsert', table: 'actions', row: data })
      },
      async deleteAction(id: string) {
        const { error } = await supabase.from('action_items').delete().eq('id', id)
        if (error) throw error
        dispatch({ type: 'remove', table: 'actions', match: (r) => r.id === id })
      },
    }
  }, [retroId, userId, scheduleUsage])

  return { ...state, ...derived, loading, error, notFound, connection, reload, mutations: mutations! }
}

export type Board = ReturnType<typeof useRetroBoard>
