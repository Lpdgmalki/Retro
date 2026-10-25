-- Remise à zéro du schéma Rétro Sprint (à exécuter AVANT de relancer la migration
-- si celle-ci a déjà été exécutée en tout ou partie). Supprime uniquement les objets de l'application.
drop policy if exists retro_presence_read on realtime.messages;
drop policy if exists retro_presence_write on realtime.messages;
drop policy if exists member_photos_insert on storage.objects;
drop policy if exists member_photos_update on storage.objects;
drop policy if exists member_photos_delete on storage.objects;

drop table if exists
  public.retro_member_invites, public.retro_invites,
  public.member_sessions, public.members, public.app_settings, public.app_admins,
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
        'get_vote_usage', 'duplicate_retro', 'is_admin', 'has_admin', 'claim_first_admin',
        'list_admins', 'add_admin', 'remove_admin', 'member_display_name', 'suggest_members',
        'identify_member', 'my_member', 'forget_identity', 'join_retro_internal',
        'join_open_retro', 'list_open_retros', 'list_my_retros', 'is_invited', 'retros_create_invite'
      )
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;

drop type if exists
  public.retro_status, public.card_category, public.participant_role,
  public.action_priority, public.action_status
  cascade;
