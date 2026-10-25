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
  participants_can_add: boolean
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
  member_id: string | null
  job_title: string
  photo_url: string
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

export type Civility = '' | 'M.' | 'Mme'

export interface Member {
  id: string
  email: string
  civility: Civility
  first_name: string
  last_name: string
  job_title: string
  photo_url: string
  active: boolean
  created_at: string
  updated_at: string
}

export type MemberProfile = Pick<Member, 'id' | 'email' | 'civility' | 'first_name' | 'last_name' | 'job_title' | 'photo_url'>

export interface AppSettings {
  id: number
  org_name: string
  welcome_title: string
  welcome_message: string
  email_suggestions: boolean
  allow_external_guests: boolean
  default_max_votes: number
  default_allow_multiple_votes: boolean
  default_confidential_votes: boolean
  default_allow_anonymous: boolean
  default_participants_can_add: boolean
  updated_at: string
}
