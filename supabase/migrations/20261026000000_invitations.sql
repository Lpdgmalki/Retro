-- =============================================================================
-- Rétro Sprint — invitations réservées aux administrateurs, accès cloisonné
-- * Le lien d'invitation n'est plus lisible que par les administrateurs
-- * Invitations nominatives depuis l'annuaire
-- * Un invité ne voit que les rétrospectives auxquelles il a été invité
-- * Seuls les administrateurs animent (facilitateurs)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Liens d'invitation : table séparée, réservée aux administrateurs
-- -----------------------------------------------------------------------------
create table public.retro_invites (
  retro_id    uuid primary key references public.retros (id) on delete cascade,
  token       text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at  timestamptz not null default now()
);

insert into public.retro_invites (retro_id, token)
select id, share_token from public.retros
on conflict (retro_id) do nothing;

create or replace function public.retros_create_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.retro_invites (retro_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger retros_create_invite after insert on public.retros
  for each row execute function public.retros_create_invite();

create or replace function public.retros_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.team_id := old.team_id;
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

-- Le jeton ne circule plus avec la rétro (ni en lecture, ni en temps réel).
drop function public.preview_retro(text);
alter table public.retros drop column share_token;

-- Invitations nominatives (membres de l'annuaire).
create table public.retro_member_invites (
  retro_id    uuid not null references public.retros (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  invited_at  timestamptz not null default now(),
  primary key (retro_id, member_id)
);
create index retro_member_invites_member_idx on public.retro_member_invites (member_id);

-- -----------------------------------------------------------------------------
-- Droits : seuls les administrateurs animent ; un invité ne voit que ses rétros
-- -----------------------------------------------------------------------------
create or replace function public.is_facilitator(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin();
$$;

create or replace function public.can_read_retro(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.is_participant(p_retro_id);
$$;

-- L'invité est-il invité (lien nominatif) à cette rétro ?
create or replace function public.is_invited(p_retro_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.retro_member_invites i
    join public.member_sessions s on s.member_id = i.member_id
    where i.retro_id = p_retro_id and s.user_id = auth.uid()
  );
$$;

drop policy action_items_update on public.action_items;
create policy action_items_update on public.action_items for update to authenticated
  using (public.is_admin() or public.is_participant(retro_id))
  with check (public.is_admin() or public.is_participant(retro_id));

alter table public.retro_invites        enable row level security;
alter table public.retro_member_invites enable row level security;

create policy retro_invites_admin_select on public.retro_invites for select to authenticated
  using (public.is_admin());
create policy retro_invites_admin_update on public.retro_invites for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy retro_member_invites_admin_select on public.retro_member_invites for select to authenticated
  using (public.is_admin());
create policy retro_member_invites_admin_insert on public.retro_member_invites for insert to authenticated
  with check (public.is_admin());
create policy retro_member_invites_admin_delete on public.retro_member_invites for delete to authenticated
  using (public.is_admin());

revoke all on public.retro_invites, public.retro_member_invites from anon, authenticated;
grant select, update (token) on public.retro_invites to authenticated;
grant select, insert, delete on public.retro_member_invites to authenticated;

-- -----------------------------------------------------------------------------
-- Rejoindre : par lien (administrateur) ou par invitation nominative
-- -----------------------------------------------------------------------------
create or replace function public.preview_retro(p_token text)
returns table (
  retro_id uuid, team_name text, sprint_name text, retro_date date,
  facilitator_name text, status public.retro_status, participant_count bigint, already_joined boolean
)
language sql stable security definer set search_path = '' as $$
  select r.id, t.name, r.sprint_name, r.retro_date, r.facilitator_name, r.status,
         (select count(*) from public.participants p where p.retro_id = r.id),
         exists (select 1 from public.participants p where p.retro_id = r.id and p.user_id = auth.uid())
  from public.retro_invites i
  join public.retros r on r.id = i.retro_id
  join public.teams t on t.id = r.team_id
  where i.token = p_token;
$$;

create or replace function public.join_retro(p_token text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_retro public.retros;
begin
  select r.* into v_retro from public.retro_invites i join public.retros r on r.id = i.retro_id
    where i.token = p_token;
  if v_retro.id is null then
    raise exception 'Lien de rétrospective invalide' using errcode = 'P0002';
  end if;
  return public.join_retro_internal(v_retro, p_display_name);
end;
$$;

-- Rejoindre sans lien : administrateur, ou invité nominativement depuis l'annuaire.
create or replace function public.join_open_retro(p_retro_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_retro public.retros;
begin
  select * into v_retro from public.retros where id = p_retro_id;
  if v_retro.id is null then
    raise exception 'Rétrospective introuvable' using errcode = 'P0002';
  end if;
  if not public.is_admin() and not public.is_invited(p_retro_id) then
    raise exception 'Vous n''êtes pas invité à cette rétrospective.' using errcode = '42501';
  end if;
  return public.join_retro_internal(v_retro, null);
end;
$$;

-- Rétrospectives de l'invité : celles qu'il a rejointes ou auxquelles il est invité.
-- (Pour un administrateur : toutes les rétrospectives en cours.)
drop function public.list_open_retros();
create or replace function public.list_my_retros()
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
  where r.status <> 'draft'
    and (
      exists (select 1 from public.participants p where p.retro_id = r.id and p.user_id = auth.uid())
      or public.is_invited(r.id)
      or (public.is_admin() and r.status in ('open', 'voting'))
    )
  order by (r.status in ('open', 'voting')) desc, r.retro_date desc, r.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke execute on function public.retros_create_invite() from public, anon, authenticated;
grant execute on function
  public.preview_retro(text),
  public.join_retro(text, text),
  public.join_open_retro(uuid),
  public.list_my_retros(),
  public.is_invited(uuid),
  public.is_facilitator(uuid),
  public.can_read_retro(uuid)
to authenticated;
revoke execute on function public.preview_retro(text), public.list_my_retros(), public.is_invited(uuid) from public, anon;
