export type RetroStatus = 'draft' | 'open' | 'voting' | 'closed'
export type CardCategory = 'positive' | 'negative' | 'improvement' | 'action'
export type ParticipantRole = 'facilitator' | 'participant'
export type ActionPriority = 'high' | 'medium' | 'low'
export type ActionStatus = 'todo' | 'in_progress' | 'done'

export interface Team {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface Retro {
  id: string
  team_id: string
  sprint_name: string
  retro_date: string
  facilitator_name: string
  goal: string
  closes_at: string | null
  status: RetroStatus
  share_token: string
  max_votes: number
  allow_multiple_votes: boolean
  confidential_votes: boolean
  votes_revealed: boolean
  allow_anonymous: boolean
  summary_notes: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RetroWithTeam extends Retro {
  teams: Pick<Team, 'id' | 'name'> | null
}

export interface Participant {
  retro_id: string
  user_id: string
  display_name: string
  role: ParticipantRole
  joined_at: string
}

export interface Card {
  id: string
  retro_id: string
  category: CardCategory
  title: string
  description: string
  author_id: string | null
  is_anonymous: boolean
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  retro_id: string
  card_id: string
  parent_id: string | null
  author_id: string | null
  body: string
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Vote {
  id: string
  retro_id: string
  card_id: string
  user_id: string
  created_at: string
}

export interface ActionItem {
  id: string
  retro_id: string
  team_id: string
  title: string
  owner_name: string
  due_date: string | null
  priority: ActionPriority
  status: ActionStatus
  source_card_id: string | null
  source_title: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ActionItemWithRetro extends ActionItem {
  retros: Pick<Retro, 'id' | 'sprint_name' | 'retro_date'> & { teams: Pick<Team, 'id' | 'name'> | null } | null
}
