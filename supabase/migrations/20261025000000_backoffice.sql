-- =============================================================================
-- Rétro Sprint — back office, annuaire des utilisateurs et site vitrine
-- * Administrateurs (seuls à créer des rétrospectives, facilitateurs partout)
-- * Annuaire interne (civilité, nom, poste, photo) + identification par e-mail
-- * Paramètres globaux de l'application
-- * Option par rétro : les participants peuvent-ils proposer des cartes ?
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.app_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.app_settings (
  id                            smallint primary key default 1 check (id = 1),
  org_name                      text not null default 'Rétro Sprint' check (char_length(btrim(org_name)) between 1 and 80),
  welcome_title                 text not null default 'Bienvenue dans nos rétrospectives' check (char_length(welcome_title) <= 120),
  welcome_message               text not null default 'Identifiez-vous avec votre adresse e-mail professionnelle pour rejoindre les rétrospectives de votre équipe.' check (char_length(welcome_message) <= 1000),
  email_suggestions             boolean not null default true,
  allow_external_guests         boolean not null default false,
  default_max_votes             integer not null default 5 check (default_max_votes between 1 and 50),
  default_allow_multiple_votes  boolean not null default false,
  default_confidential_votes    boolean not null default false,
  default_allow_anonymous       boolean not null default true,
  default_participants_can_add  boolean not null default true,
  updated_at                    timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  civility    text not null default '' check (civility in ('', 'M.', 'Mme')),
  first_name  text not null default '' check (char_length(first_name) <= 60),
  last_name   text not null default '' check (char_length(last_name) <= 60),
  job_title   text not null default '' check (char_length(job_title) <= 100),
  photo_url   text not null default '' check (char_length(photo_url) <= 1000),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index members_email_key on public.members (lower(email));

-- Identité annuaire associée à une session (navigateur).
create table public.member_sessions (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  member_id      uuid not null references public.members (id) on delete cascade,
  identified_at  timestamptz not null default now()
);
create index member_sessions_member_idx on public.member_sessions (member_id);

alter table public.participants
  add column member_id  uuid references public.members (id) on delete set null,
  add column job_title  text not null default '' check (char_length(job_title) <= 100),
  add column photo_url  text not null default '' check (char_length(photo_url) <= 1000);

alter table public.retros
  add column participants_can_add boolean not null default true;

create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Autorisations
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- Les administrateurs sont facilitateurs de toutes les rétrospectives.
create or replace function public.is_facilitator(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.participants
    where retro_id = p_retro_id and user_id = auth.uid() and role = 'facilitator'
  );
$$;

create or replace function public.can_read_retro(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.is_participant(p_retro_id) or exists (
    select 1 from public.retros r
    join public.team_members tm on tm.team_id = r.team_id
    where r.id = p_retro_id and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

alter table public.app_admins       enable row level security;
alter table public.app_settings     enable row level security;
alter table public.members          enable row level security;
alter table public.member_sessions  enable row level security;

create policy app_admins_select on public.app_admins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy app_settings_select on public.app_settings for select to authenticated using (true);
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy members_admin_select on public.members for select to authenticated using (public.is_admin());
create policy members_admin_insert on public.members for insert to authenticated with check (public.is_admin());
create policy members_admin_update on public.members for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy members_admin_delete on public.members for delete to authenticated using (public.is_admin());

create policy member_sessions_select on public.member_sessions for select to authenticated
  using (user_id = auth.uid());

revoke all on public.app_admins, public.app_settings, public.members, public.member_sessions from anon, authenticated;
grant select on public.app_admins, public.app_settings, public.member_sessions to authenticated;
grant update on public.app_settings to authenticated;
grant select, insert, update, delete on public.members to authenticated;

-- -----------------------------------------------------------------------------
-- Photos de l'annuaire (Supabase Storage, lecture publique, écriture admin)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy member_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and public.is_admin());
create policy member_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and public.is_admin());
create policy member_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and public.is_admin());

-- -----------------------------------------------------------------------------
-- Administrateurs
-- -----------------------------------------------------------------------------
create or replace function public.has_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins);
$$;

-- Le tout premier compte (e-mail + mot de passe) devient administrateur.
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Connectez-vous avec un compte e-mail' using errcode = '42501';
  end if;
  lock table public.app_admins in exclusive mode;
  if exists (select 1 from public.app_admins) then
    raise exception 'Un administrateur existe déjà' using errcode = '42501';
  end if;
  insert into public.app_admins (user_id) values (auth.uid());
  return true;
end;
$$;

create or replace function public.list_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
    select a.user_id, u.email::text, a.created_at
    from public.app_admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

-- Promeut un compte existant (il doit s'être inscrit sur la page de connexion).
create or replace function public.add_admin(p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  select id into v_user from auth.users
    where lower(email) = lower(btrim(p_email)) and not coalesce(is_anonymous, false)
    limit 1;
  if v_user is null then
    raise exception 'Aucun compte avec cet e-mail. La personne doit d''abord créer son compte sur la page de connexion du back office.' using errcode = 'P0002';
  end if;
  insert into public.app_admins (user_id) values (v_user) on conflict do nothing;
  return v_user;
end;
$$;

create or replace function public.remove_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if (select count(*) from public.app_admins) <= 1 then
    raise exception 'Il doit rester au moins un administrateur' using errcode = 'P0001';
  end if;
  delete from public.app_admins where user_id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Annuaire : suggestions et identification
-- -----------------------------------------------------------------------------
create or replace function public.member_display_name(m public.members)
returns text language sql immutable set search_path = '' as $$
  select left(coalesce(
    nullif(btrim(concat_ws(' ', nullif(m.first_name, ''), nullif(m.last_name, ''))), ''),
    split_part(m.email, '@', 1)
  ), 40);
$$;

-- Suggestions d'e-mails pendant la saisie (désactivables : correspondance exacte uniquement).
create or replace function public.suggest_members(p_query text)
returns table (id uuid, email text, civility text, first_name text, last_name text, job_title text, photo_url text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_suggest boolean;
begin
  if auth.uid() is null or char_length(v_q) < 2 then
    return;
  end if;
  select s.email_suggestions into v_suggest from public.app_settings s where s.id = 1;
  return query
    select m.id, m.email, m.civility, m.first_name, m.last_name, m.job_title, m.photo_url
    from public.members m
    where m.active
      and (
        lower(m.email) = v_q
        or (coalesce(v_suggest, true) and (
          lower(m.email) like replace(replace(v_q, '%', ''), '_', '\_') || '%'
          or lower(m.first_name || ' ' || m.last_name) like '%' || replace(replace(v_q, '%', ''), '_', '\_') || '%'
        ))
      )
    order by (lower(m.email) = v_q) desc, m.email
    limit 6;
end;
$$;

create or replace function public.identify_member(p_email text)
returns public.members
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  select * into v_member from public.members
    where lower(email) = lower(btrim(coalesce(p_email, ''))) and active;
  if v_member.id is null then
    raise exception 'Adresse e-mail inconnue. Contactez l''administrateur pour être ajouté à l''annuaire.' using errcode = 'P0002';
  end if;
  insert into public.member_sessions (user_id, member_id) values (auth.uid(), v_member.id)
  on conflict (user_id) do update set member_id = excluded.member_id, identified_at = now();
  -- Met à jour l'identité affichée dans les rétros déjà rejointes avec cette session.
  update public.participants
    set member_id = v_member.id,
        display_name = public.member_display_name(v_member),
        job_title = v_member.job_title,
        photo_url = v_member.photo_url
    where user_id = auth.uid();
  return v_member;
end;
$$;

create or replace function public.my_member()
returns setof public.members
language sql stable security definer set search_path = '' as $$
  select m.* from public.member_sessions s
  join public.members m on m.id = s.member_id
  where s.user_id = auth.uid() and m.active;
$$;

create or replace function public.forget_identity()
returns void language sql security definer set search_path = '' as $$
  delete from public.member_sessions where user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Rejoindre une rétrospective
-- -----------------------------------------------------------------------------
create or replace function public.join_retro_internal(p_retro public.retros, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_member  public.members;
  v_admin   boolean := public.is_admin();
  v_name    text;
  v_allow   boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  select m.* into v_member from public.member_sessions s
    join public.members m on m.id = s.member_id
    where s.user_id = v_uid and m.active;

  if v_member.id is not null then
    v_name := public.member_display_name(v_member);
  else
    select allow_external_guests into v_allow from public.app_settings where id = 1;
    if not v_admin and not coalesce(v_allow, false) then
      raise exception 'Identifiez-vous avec votre adresse e-mail professionnelle pour rejoindre la rétrospective.' using errcode = '42501';
    end if;
    v_name := btrim(coalesce(p_display_name, ''));
    if char_length(v_name) not between 1 and 40 then
      raise exception 'Le pseudo doit contenir entre 1 et 40 caractères' using errcode = '22023';
    end if;
  end if;

  insert into public.participants (retro_id, user_id, display_name, role, member_id, job_title, photo_url)
  values (p_retro.id, v_uid, v_name, case when v_admin then 'facilitator' else 'participant' end::public.participant_role,
          v_member.id, coalesce(v_member.job_title, ''), coalesce(v_member.photo_url, ''))
  on conflict (retro_id, user_id) do update
    set display_name = excluded.display_name,
        member_id = excluded.member_id,
        job_title = excluded.job_title,
        photo_url = excluded.photo_url;

  insert into public.team_members (team_id, user_id)
  values (p_retro.team_id, v_uid)
  on conflict do nothing;

  return p_retro.id;
end;
$$;

create or replace function public.join_retro(p_token text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_retro public.retros;
begin
  select * into v_retro from public.retros where share_token = p_token;
  if v_retro.id is null then
    raise exception 'Lien de rétrospective invalide' using errcode = 'P0002';
  end if;
  return public.join_retro_internal(v_retro, p_display_name);
end;
$$;

-- Depuis le site vitrine : rétros en cours, accessibles aux personnes identifiées.
create or replace function public.join_open_retro(p_retro_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_retro public.retros;
begin
  select * into v_retro from public.retros where id = p_retro_id;
  if v_retro.id is null or (v_retro.status not in ('open', 'voting') and not public.is_admin()) then
    raise exception 'Cette rétrospective n''est pas ouverte' using errcode = 'P0002';
  end if;
  if not public.is_admin() and not exists (select 1 from public.member_sessions where user_id = auth.uid()) then
    raise exception 'Identifiez-vous avec votre adresse e-mail professionnelle.' using errcode = '42501';
  end if;
  return public.join_retro_internal(v_retro, null);
end;
$$;

create or replace function public.list_open_retros()
returns table (
  retro_id uuid, team_name text, sprint_name text, retro_date date, facilitator_name text,
  status public.retro_status, participant_count bigint, joined boolean
)
language sql stable security definer set search_path = '' as $$
  select r.id, t.name, r.sprint_name, r.retro_date, r.facilitator_name, r.status,
         (select count(*) from public.participants p where p.retro_id = r.id),
         exists (select 1 from public.participants p where p.retro_id = r.id and p.user_id = auth.uid())
  from public.retros r
  join public.teams t on t.id = r.team_id
  where r.status in ('open', 'voting')
    and (public.is_admin() or exists (select 1 from public.member_sessions s where s.user_id = auth.uid()))
  order by r.retro_date desc, r.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Création réservée aux administrateurs
-- -----------------------------------------------------------------------------
drop function public.create_retro(uuid, text, text, date, text, text, timestamptz, integer, boolean, boolean, boolean, text);

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
  p_participants_can_add boolean,
  p_display_name         text
) returns public.retros
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_team  uuid := p_team_id;
  v_retro public.retros;
begin
  if not public.is_admin() then
    raise exception 'Seuls les administrateurs peuvent créer une rétrospective' using errcode = '42501';
  end if;

  if v_team is null then
    if p_team_name is null or btrim(p_team_name) = '' then
      raise exception 'Le nom de l''équipe est obligatoire' using errcode = '22023';
    end if;
    insert into public.teams (name, created_by) values (btrim(p_team_name), v_uid)
      returning id into v_team;
    insert into public.team_members (team_id, user_id) values (v_team, v_uid);
  elsif not exists (select 1 from public.teams where id = v_team) then
    raise exception 'Équipe introuvable' using errcode = 'P0002';
  end if;

  insert into public.retros (
    team_id, sprint_name, retro_date, facilitator_name, goal, closes_at,
    max_votes, allow_multiple_votes, confidential_votes, allow_anonymous, participants_can_add, created_by
  ) values (
    v_team, btrim(p_sprint_name), coalesce(p_retro_date, current_date), btrim(p_facilitator_name),
    coalesce(p_goal, ''), p_closes_at, coalesce(p_max_votes, 5),
    coalesce(p_allow_multiple_votes, false), coalesce(p_confidential_votes, false),
    coalesce(p_allow_anonymous, true), coalesce(p_participants_can_add, true), v_uid
  ) returning * into v_retro;

  insert into public.participants (retro_id, user_id, display_name, role)
  values (v_retro.id, v_uid, left(btrim(coalesce(nullif(btrim(p_display_name), ''), p_facilitator_name)), 40), 'facilitator');
  insert into public.team_members (team_id, user_id) values (v_team, v_uid) on conflict do nothing;

  return v_retro;
end;
$$;

-- Cartes : les participants ne proposent des cartes que si la rétro l'autorise.
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
  v_fac   boolean := public.is_facilitator(p_retro_id);
begin
  if not public.is_participant(p_retro_id) then
    raise exception 'Vous devez rejoindre la rétrospective pour contribuer' using errcode = '42501';
  end if;

  select * into v_retro from public.retros where id = p_retro_id;
  if not (
    (v_fac and v_retro.status in ('draft', 'open', 'voting'))
    or (public.contributions_open(p_retro_id) and v_retro.participants_can_add)
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

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_retro(uuid, text, text, date, text, text, timestamptz, integer, boolean, boolean, boolean, boolean, text),
  public.preview_retro(text),
  public.join_retro(text, text),
  public.join_open_retro(uuid),
  public.list_open_retros(),
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
  public.is_card_owner(uuid),
  public.is_admin(),
  public.has_admin(),
  public.claim_first_admin(),
  public.list_admins(),
  public.add_admin(text),
  public.remove_admin(uuid),
  public.suggest_members(text),
  public.identify_member(text),
  public.my_member(),
  public.forget_identity()
to authenticated;
