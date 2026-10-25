-- =============================================================================
-- INSTALLATION COMPLÈTE DE RÉTRO SPRINT (à copier-coller en entier dans le SQL Editor)
-- Peut être relancé sans risque : efface d'abord l'installation précédente de l'application.
-- =============================================================================

-- Remise à zéro du schéma Rétro Sprint (à exécuter AVANT de relancer la migration
-- si celle-ci a déjà été exécutée en tout ou partie). Supprime uniquement les objets de l'application.
drop policy if exists retro_presence_read on realtime.messages;
drop policy if exists retro_presence_write on realtime.messages;

drop table if exists
  public.action_items, public.votes, public.comments, public.card_owners,
  public.cards, public.participants, public.retros, public.team_members, public.teams
  cascade;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'is_participant', 'is_facilitator', 'is_team_member', 'can_read_retro', 'retro_status_of',
        'contributions_open', 'discussion_open', 'is_card_owner', 'touch_updated_at', 'retros_guard',
        'participants_guard', 'cards_guard', 'comments_guard', 'action_items_guard', 'create_retro',
        'preview_retro', 'join_retro', 'create_card', 'cast_vote', 'remove_vote', 'get_vote_totals',
        'get_vote_usage', 'duplicate_retro'
      )
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;

drop type if exists
  public.retro_status, public.card_category, public.participant_role,
  public.action_priority, public.action_status
  cascade;

-- =============================================================================
-- Rétro Sprint — schéma initial
-- Équipes, rétrospectives, participants, cartes, commentaires, votes, actions.
-- Toute la sécurité est appliquée côté base : RLS + fonctions SECURITY DEFINER.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.retro_status as enum ('draft', 'open', 'voting', 'closed');
create type public.card_category as enum ('positive', 'negative', 'improvement', 'action');
create type public.participant_role as enum ('facilitator', 'participant');
create type public.action_priority as enum ('high', 'medium', 'low');
create type public.action_status as enum ('todo', 'in_progress', 'done');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.retros (
  id                    uuid primary key default gen_random_uuid(),
  team_id               uuid not null references public.teams (id) on delete cascade,
  sprint_name           text not null check (char_length(btrim(sprint_name)) between 1 and 80),
  retro_date            date not null default current_date,
  facilitator_name      text not null check (char_length(btrim(facilitator_name)) between 1 and 60),
  goal                  text not null default '' check (char_length(goal) <= 1000),
  closes_at             timestamptz,
  status                public.retro_status not null default 'draft',
  share_token           text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  max_votes             integer not null default 5 check (max_votes between 1 and 50),
  allow_multiple_votes  boolean not null default false,
  confidential_votes    boolean not null default false,
  votes_revealed        boolean not null default false,
  allow_anonymous       boolean not null default true,
  summary_notes         text not null default '' check (char_length(summary_notes) <= 5000),
  created_by            uuid references auth.users (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index retros_team_idx on public.retros (team_id, retro_date desc);

create table public.participants (
  retro_id      uuid not null references public.retros (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 40),
  role          public.participant_role not null default 'participant',
  joined_at     timestamptz not null default now(),
  primary key (retro_id, user_id)
);
create index participants_user_idx on public.participants (user_id);

create table public.cards (
  id            uuid primary key default gen_random_uuid(),
  retro_id      uuid not null references public.retros (id) on delete cascade,
  category      public.card_category not null,
  title         text not null check (char_length(btrim(title)) between 1 and 140),
  description   text not null default '' check (char_length(description) <= 2000),
  -- NULL lorsque la carte est anonyme : l'auteur réel n'est jamais exposé.
  author_id     uuid references auth.users (id) on delete set null,
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index cards_retro_idx on public.cards (retro_id);

-- Propriété réelle des cartes (y compris anonymes). Lisible uniquement par son propriétaire.
create table public.card_owners (
  card_id  uuid primary key references public.cards (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade
);
create index card_owners_user_idx on public.card_owners (user_id);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  retro_id    uuid not null references public.retros (id) on delete cascade,
  card_id     uuid not null references public.cards (id) on delete cascade,
  parent_id   uuid references public.comments (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null default auth.uid(),
  body        text not null default '' check (char_length(body) <= 2000),
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (is_deleted or char_length(btrim(body)) >= 1)
);
create index comments_card_idx on public.comments (card_id);
create index comments_retro_idx on public.comments (retro_id);

create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  retro_id    uuid not null references public.retros (id) on delete cascade,
  card_id     uuid not null references public.cards (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index votes_retro_user_idx on public.votes (retro_id, user_id);
create index votes_card_idx on public.votes (card_id);

create table public.action_items (
  id              uuid primary key default gen_random_uuid(),
  retro_id        uuid not null references public.retros (id) on delete cascade,
  team_id         uuid not null references public.teams (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  owner_name      text not null default '' check (char_length(owner_name) <= 60),
  due_date        date,
  priority        public.action_priority not null default 'medium',
  status          public.action_status not null default 'todo',
  source_card_id  uuid references public.cards (id) on delete set null,
  source_title    text not null default '' check (char_length(source_title) <= 140),
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index action_items_retro_idx on public.action_items (retro_id);
create index action_items_team_idx on public.action_items (team_id, status);

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation (SECURITY DEFINER pour éviter la récursion RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_participant(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants
    where retro_id = p_retro_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_facilitator(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants
    where retro_id = p_retro_id and user_id = auth.uid() and role = 'facilitator'
  );
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

-- Lecture : participant de la rétro ou membre de l'équipe (historique).
create or replace function public.can_read_retro(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_participant(p_retro_id) or exists (
    select 1 from public.retros r
    join public.team_members tm on tm.team_id = r.team_id
    where r.id = p_retro_id and tm.user_id = auth.uid()
  );
$$;

create or replace function public.retro_status_of(p_retro_id uuid)
returns public.retro_status language sql stable security definer set search_path = '' as $$
  select status from public.retros where id = p_retro_id;
$$;

-- Les contributions sont-elles ouvertes (statut + date de clôture) ?
create or replace function public.contributions_open(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.retros
    where id = p_retro_id
      and status = 'open'
      and (closes_at is null or closes_at > now())
  );
$$;

-- Les échanges (commentaires) sont autorisés tant que la rétro n'est pas terminée.
create or replace function public.discussion_open(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.retros
    where id = p_retro_id
      and status in ('open', 'voting')
      and (closes_at is null or closes_at > now())
  );
$$;

create or replace function public.is_card_owner(p_card_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.card_owners where card_id = p_card_id and user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger retros_touch before update on public.retros
  for each row execute function public.touch_updated_at();
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments
  for each row execute function public.touch_updated_at();
create trigger action_items_touch before update on public.action_items
  for each row execute function public.touch_updated_at();

-- Rétros : champs immuables + révélation automatique des votes confidentiels.
create or replace function public.retros_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.team_id := old.team_id;
  new.share_token := old.share_token;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if new.status is distinct from old.status then
    if old.status = 'voting' then
      new.votes_revealed := true;      -- clôture du vote : résultats agrégés visibles
    elsif new.status = 'voting' then
      new.votes_revealed := false;     -- nouveau tour de vote : on masque à nouveau
    end if;
  end if;
  return new;
end;
$$;
create trigger retros_guard before update on public.retros
  for each row execute function public.retros_guard();

-- Participants : seul un facilitateur peut changer un rôle ; il reste au moins un facilitateur.
create or replace function public.participants_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.retro_id := old.retro_id;
    new.user_id := old.user_id;
    new.joined_at := old.joined_at;
    if new.role is distinct from old.role and not public.is_facilitator(old.retro_id) then
      raise exception 'Seul un facilitateur peut modifier les rôles' using errcode = '42501';
    end if;
  end if;

  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role <> 'facilitator'))
     and old.role = 'facilitator'
     and exists (select 1 from public.retros where id = old.retro_id)
     and not exists (
       select 1 from public.participants
       where retro_id = old.retro_id and role = 'facilitator' and user_id <> old.user_id
     ) then
    raise exception 'La rétrospective doit conserver au moins un facilitateur' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger participants_guard before update or delete on public.participants
  for each row execute function public.participants_guard();

-- Cartes : champs immuables à la mise à jour.
create or replace function public.cards_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.retro_id := old.retro_id;
  new.author_id := old.author_id;
  new.is_anonymous := old.is_anonymous;
  new.created_at := old.created_at;
  -- Seul un facilitateur peut déplacer une carte vers une autre colonne.
  if new.category is distinct from old.category and not public.is_facilitator(old.retro_id) then
    new.category := old.category;
  end if;
  return new;
end;
$$;
create trigger cards_guard before update on public.cards
  for each row execute function public.cards_guard();

-- Commentaires : cohérence à l'insertion, champs immuables, suppression douce si réponses.
-- SECURITY DEFINER : la suppression douce doit fonctionner même quand le facilitateur
-- modère le commentaire d'un autre participant.
create or replace function public.comments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent public.comments;
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.is_deleted := false;
    select c.retro_id into new.retro_id from public.cards c where c.id = new.card_id;
    if new.parent_id is not null then
      select * into v_parent from public.comments where id = new.parent_id;
      if v_parent.id is null or v_parent.card_id <> new.card_id then
        raise exception 'Commentaire parent invalide' using errcode = '22023';
      end if;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.retro_id := old.retro_id;
    new.card_id := old.card_id;
    new.parent_id := old.parent_id;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    if old.is_deleted then
      raise exception 'Ce commentaire a été supprimé' using errcode = 'P0001';
    end if;
    return new;
  else -- DELETE
    if pg_trigger_depth() = 1
       and exists (select 1 from public.comments where parent_id = old.id and not is_deleted)
       and exists (select 1 from public.cards where id = old.card_id) then
      update public.comments set is_deleted = true, body = '' where id = old.id;
      return null;
    end if;
    return old;
  end if;
end;
$$;
create trigger comments_guard before insert or update or delete on public.comments
  for each row execute function public.comments_guard();

-- Actions : équipe dérivée de la rétro, carte source cohérente.
create or replace function public.action_items_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_card public.cards;
begin
  if tg_op = 'INSERT' then
    select team_id into new.team_id from public.retros where id = new.retro_id;
    new.created_by := auth.uid();
  else
    new.id := old.id;
    new.retro_id := old.retro_id;
    new.team_id := old.team_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  if new.source_card_id is not null
     and (tg_op = 'INSERT' or new.source_card_id is distinct from old.source_card_id) then
    select * into v_card from public.cards where id = new.source_card_id;
    if v_card.id is null or v_card.retro_id <> new.retro_id then
      raise exception 'La carte source doit appartenir à la même rétrospective' using errcode = '22023';
    end if;
    if btrim(new.source_title) = '' then
      new.source_title := v_card.title;
    end if;
  end if;
  return new;
end;
$$;
create trigger action_items_guard before insert or update on public.action_items
  for each row execute function public.action_items_guard();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.retros        enable row level security;
alter table public.participants  enable row level security;
alter table public.cards         enable row level security;
alter table public.card_owners   enable row level security;
alter table public.comments      enable row level security;
alter table public.votes         enable row level security;
alter table public.action_items  enable row level security;

-- Équipes : lecture par les membres ; création/adhésion via RPC uniquement.
create policy teams_select on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy teams_update on public.teams for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy team_members_select on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
create policy team_members_leave on public.team_members for delete to authenticated
  using (user_id = auth.uid());

-- Rétrospectives
create policy retros_select on public.retros for select to authenticated
  using (public.can_read_retro(id));
create policy retros_update on public.retros for update to authenticated
  using (public.is_facilitator(id)) with check (public.is_facilitator(id));
create policy retros_delete on public.retros for delete to authenticated
  using (public.is_facilitator(id));

-- Participants
create policy participants_select on public.participants for select to authenticated
  using (public.can_read_retro(retro_id));
create policy participants_update on public.participants for update to authenticated
  using (user_id = auth.uid() or public.is_facilitator(retro_id))
  with check (user_id = auth.uid() or public.is_facilitator(retro_id));
create policy participants_delete on public.participants for delete to authenticated
  using (public.is_facilitator(retro_id));

-- Cartes : création via RPC (gère l'anonymat), modification par le propriétaire.
create policy cards_select on public.cards for select to authenticated
  using (public.can_read_retro(retro_id));
create policy cards_update on public.cards for update to authenticated
  using (
    public.is_facilitator(retro_id)
    or (public.is_card_owner(id) and public.retro_status_of(retro_id) in ('draft', 'open', 'voting'))
  )
  with check (
    public.is_facilitator(retro_id)
    or (public.is_card_owner(id) and public.retro_status_of(retro_id) in ('draft', 'open', 'voting'))
  );
create policy cards_delete on public.cards for delete to authenticated
  using (
    public.is_facilitator(retro_id)
    or (public.is_card_owner(id) and public.retro_status_of(retro_id) in ('draft', 'open'))
  );

create policy card_owners_select on public.card_owners for select to authenticated
  using (user_id = auth.uid());

-- Commentaires
create policy comments_select on public.comments for select to authenticated
  using (public.can_read_retro(retro_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_participant(retro_id)
    and public.discussion_open(retro_id)
  );
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid() and public.discussion_open(retro_id))
  with check (author_id = auth.uid() and public.discussion_open(retro_id));
create policy comments_delete on public.comments for delete to authenticated
  using (
    (author_id = auth.uid() and public.discussion_open(retro_id))
    or public.is_facilitator(retro_id)
  );

-- Votes : lecture de ses propres votes ; ceux des autres seulement en mode non confidentiel.
-- Écriture exclusivement via cast_vote / remove_vote.
create policy votes_select on public.votes for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.can_read_retro(retro_id)
      and not exists (select 1 from public.retros r where r.id = retro_id and r.confidential_votes)
    )
  );

-- Actions : facilitateur pour créer/supprimer ; membres de l'équipe pour suivre l'avancement.
create policy action_items_select on public.action_items for select to authenticated
  using (public.can_read_retro(retro_id));
create policy action_items_insert on public.action_items for insert to authenticated
  with check (public.is_facilitator(retro_id));
create policy action_items_update on public.action_items for update to authenticated
  using (public.is_facilitator(retro_id) or public.is_team_member(team_id))
  with check (public.is_facilitator(retro_id) or public.is_team_member(team_id));
create policy action_items_delete on public.action_items for delete to authenticated
  using (public.is_facilitator(retro_id));

-- Privilèges explicites (ne dépendent pas des droits par défaut du projet, que Supabase
-- n'accorde plus automatiquement sur les projets récents). Aucune écriture directe sur
-- les tables gérées par RPC ; la RLS filtre ensuite chaque ligne.
grant usage on schema public to anon, authenticated;
revoke all on
  public.teams, public.team_members, public.retros, public.participants, public.cards,
  public.card_owners, public.comments, public.votes, public.action_items
  from anon, authenticated;
grant select on
  public.teams, public.team_members, public.retros, public.participants, public.cards,
  public.card_owners, public.comments, public.votes, public.action_items
  to authenticated;
grant update (name) on public.teams to authenticated;
grant delete on public.team_members to authenticated;
grant update, delete on public.retros, public.participants, public.cards to authenticated;
grant insert, update, delete on public.comments, public.action_items to authenticated;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Création d'une rétrospective (et de l'équipe si nécessaire).
create or replace function public.create_retro(
  p_team_id              uuid,
  p_team_name            text,
  p_sprint_name          text,
  p_retro_date           date,
  p_facilitator_name     text,
  p_goal                 text,
  p_closes_at            timestamptz,
  p_max_votes            integer,
  p_allow_multiple_votes boolean,
  p_confidential_votes   boolean,
  p_allow_anonymous      boolean,
  p_display_name         text
) returns public.retros
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_team  uuid := p_team_id;
  v_retro public.retros;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if v_team is null then
    if p_team_name is null or btrim(p_team_name) = '' then
      raise exception 'Le nom de l''équipe est obligatoire' using errcode = '22023';
    end if;
    insert into public.teams (name, created_by) values (btrim(p_team_name), v_uid)
      returning id into v_team;
    insert into public.team_members (team_id, user_id) values (v_team, v_uid);
  elsif not public.is_team_member(v_team) then
    raise exception 'Vous n''êtes pas membre de cette équipe' using errcode = '42501';
  end if;

  insert into public.retros (
    team_id, sprint_name, retro_date, facilitator_name, goal, closes_at,
    max_votes, allow_multiple_votes, confidential_votes, allow_anonymous, created_by
  ) values (
    v_team, btrim(p_sprint_name), coalesce(p_retro_date, current_date), btrim(p_facilitator_name),
    coalesce(p_goal, ''), p_closes_at, coalesce(p_max_votes, 5),
    coalesce(p_allow_multiple_votes, false), coalesce(p_confidential_votes, false),
    coalesce(p_allow_anonymous, true), v_uid
  ) returning * into v_retro;

  insert into public.participants (retro_id, user_id, display_name, role)
  values (v_retro.id, v_uid, btrim(coalesce(nullif(btrim(p_display_name), ''), p_facilitator_name)), 'facilitator');

  return v_retro;
end;
$$;

-- Aperçu public minimal d'une rétro à partir de son lien de partage.
create or replace function public.preview_retro(p_token text)
returns table (
  retro_id uuid, team_name text, sprint_name text, retro_date date,
  facilitator_name text, status public.retro_status, participant_count bigint, already_joined boolean
)
language sql stable security definer set search_path = '' as $$
  select r.id, t.name, r.sprint_name, r.retro_date, r.facilitator_name, r.status,
         (select count(*) from public.participants p where p.retro_id = r.id),
         exists (select 1 from public.participants p where p.retro_id = r.id and p.user_id = auth.uid())
  from public.retros r
  join public.teams t on t.id = r.team_id
  where r.share_token = p_token;
$$;

-- Rejoindre une rétro via son lien de partage.
create or replace function public.join_retro(p_token text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_retro public.retros;
  v_name  text := btrim(coalesce(p_display_name, ''));
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 then
    raise exception 'Le pseudo doit contenir entre 1 et 40 caractères' using errcode = '22023';
  end if;

  select * into v_retro from public.retros where share_token = p_token;
  if v_retro.id is null then
    raise exception 'Lien de rétrospective invalide' using errcode = 'P0002';
  end if;

  insert into public.participants (retro_id, user_id, display_name)
  values (v_retro.id, v_uid, v_name)
  on conflict (retro_id, user_id) do update set display_name = excluded.display_name;

  insert into public.team_members (team_id, user_id)
  values (v_retro.team_id, v_uid)
  on conflict do nothing;

  return v_retro.id;
end;
$$;

-- Création d'une carte (gère l'anonymat et l'ouverture des contributions).
create or replace function public.create_card(
  p_retro_id    uuid,
  p_category    public.card_category,
  p_title       text,
  p_description text,
  p_anonymous   boolean
) returns public.cards
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_retro public.retros;
  v_card  public.cards;
  v_anon  boolean := coalesce(p_anonymous, false);
begin
  if not public.is_participant(p_retro_id) then
    raise exception 'Vous devez rejoindre la rétrospective pour contribuer' using errcode = '42501';
  end if;

  select * into v_retro from public.retros where id = p_retro_id;
  if not (
    public.contributions_open(p_retro_id)
    or (public.is_facilitator(p_retro_id) and v_retro.status in ('draft', 'open', 'voting'))
  ) then
    raise exception 'Les contributions sont fermées' using errcode = 'P0001';
  end if;
  if v_anon and not v_retro.allow_anonymous then
    raise exception 'Les contributions anonymes sont désactivées' using errcode = 'P0001';
  end if;

  insert into public.cards (retro_id, category, title, description, author_id, is_anonymous)
  values (p_retro_id, p_category, btrim(p_title), coalesce(btrim(p_description), ''),
          case when v_anon then null else v_uid end, v_anon)
  returning * into v_card;

  insert into public.card_owners (card_id, user_id) values (v_card.id, v_uid);
  return v_card;
end;
$$;

-- Vote : contrôle du statut, du quota et des votes multiples, sans condition de course.
create or replace function public.cast_vote(p_card_id uuid)
returns public.votes
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_card  public.cards;
  v_retro public.retros;
  v_used  integer;
  v_vote  public.votes;
begin
  select * into v_card from public.cards where id = p_card_id;
  if v_card.id is null then
    raise exception 'Carte introuvable' using errcode = 'P0002';
  end if;

  -- Verrou sur la ligne du participant : sérialise les votes concurrents d'un même utilisateur.
  perform 1 from public.participants
    where retro_id = v_card.retro_id and user_id = v_uid
    for update;
  if not found then
    raise exception 'Vous devez rejoindre la rétrospective pour voter' using errcode = '42501';
  end if;

  select * into v_retro from public.retros where id = v_card.retro_id;
  if v_retro.status <> 'voting' then
    raise exception 'Le vote n''est pas ouvert' using errcode = 'P0001';
  end if;

  select count(*) into v_used from public.votes
    where retro_id = v_retro.id and user_id = v_uid;
  if v_used >= v_retro.max_votes then
    raise exception 'Vous avez utilisé tous vos votes (%)', v_retro.max_votes using errcode = 'P0001';
  end if;

  if not v_retro.allow_multiple_votes and exists (
    select 1 from public.votes where card_id = p_card_id and user_id = v_uid
  ) then
    raise exception 'Vous avez déjà voté pour cette idée' using errcode = 'P0001';
  end if;

  insert into public.votes (retro_id, card_id, user_id)
  values (v_retro.id, p_card_id, v_uid)
  returning * into v_vote;
  return v_vote;
end;
$$;

-- Retrait d'un vote (le plus récent de l'utilisateur sur la carte).
create or replace function public.remove_vote(p_card_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_card public.cards;
  v_id   uuid;
begin
  select * into v_card from public.cards where id = p_card_id;
  if v_card.id is null then
    raise exception 'Carte introuvable' using errcode = 'P0002';
  end if;
  if public.retro_status_of(v_card.retro_id) <> 'voting' then
    raise exception 'Le vote n''est pas ouvert' using errcode = 'P0001';
  end if;

  select id into v_id from public.votes
    where card_id = p_card_id and user_id = v_uid
    order by created_at desc
    limit 1;
  if v_id is null then
    raise exception 'Aucun vote à retirer' using errcode = 'P0002';
  end if;

  delete from public.votes where id = v_id;
  return v_id;
end;
$$;

-- Totaux agrégés : toujours disponibles hors mode confidentiel ; en mode confidentiel,
-- uniquement une fois le vote clôturé. Les votes individuels ne sont jamais exposés ici.
create or replace function public.get_vote_totals(p_retro_id uuid)
returns table (card_id uuid, votes bigint)
language sql stable security definer set search_path = '' as $$
  select v.card_id, count(*)
  from public.votes v
  join public.retros r on r.id = v.retro_id
  where v.retro_id = p_retro_id
    and public.can_read_retro(p_retro_id)
    and (not r.confidential_votes or r.votes_revealed)
  group by v.card_id;
$$;

-- Participation au vote : nombre de votes utilisés par participant (sans les cibles).
create or replace function public.get_vote_usage(p_retro_id uuid)
returns table (user_id uuid, used bigint)
language sql stable security definer set search_path = '' as $$
  select p.user_id, count(v.id)
  from public.participants p
  left join public.votes v on v.retro_id = p.retro_id and v.user_id = p.user_id
  where p.retro_id = p_retro_id and public.can_read_retro(p_retro_id)
  group by p.user_id;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_retro(uuid, text, text, date, text, text, timestamptz, integer, boolean, boolean, boolean, text),
  public.preview_retro(text),
  public.join_retro(text, text),
  public.create_card(uuid, public.card_category, text, text, boolean),
  public.cast_vote(uuid),
  public.remove_vote(uuid),
  public.get_vote_totals(uuid),
  public.get_vote_usage(uuid),
  public.is_participant(uuid),
  public.is_facilitator(uuid),
  public.is_team_member(uuid),
  public.can_read_retro(uuid),
  public.retro_status_of(uuid),
  public.contributions_open(uuid),
  public.discussion_open(uuid),
  public.is_card_owner(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Temps réel
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.retros, public.participants, public.cards, public.comments, public.votes, public.action_items;

-- Présence (qui est en ligne) sur des canaux privés « retro:<id> » réservés aux participants.
create policy retro_presence_read on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'retro:%'
    and public.is_participant(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
  );
create policy retro_presence_write on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'retro:%'
    and public.is_participant(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
  );
