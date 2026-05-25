create or replace function public.trip_pending_invites_for_current_user()
returns table (
  token text,
  trip_id uuid,
  trip_name text,
  member_id uuid,
  member_name text,
  role text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if v_uid is null then
    return;
  end if;

  if v_email = '' then
    select lower(trim(coalesce(u.email, '')))
      into v_email
    from auth.users u
    where u.id = v_uid;
  end if;

  if v_email = '' then
    return;
  end if;

  return query
  select
    ti.token::text,
    ti.trip_id,
    coalesce(tg.name, 'Trip')::text as trip_name,
    tm.id as member_id,
    coalesce(tm.name, 'Participant')::text as member_name,
    coalesce(ti.role, 'member')::text as role,
    ti.expires_at,
    ti.created_at
  from public.trip_invites ti
  join public.trip_members tm
    on tm.id = ti.member_id
   and tm.trip_id = ti.trip_id
  join public.trip_groups tg
    on tg.id = ti.trip_id
  where ti.used_at is null
    and ti.expires_at > now()
    and lower(trim(coalesce(tm.email, ''))) = v_email
    and not exists (
      select 1
      from public.trip_participants tp
      where tp.trip_id = ti.trip_id
        and tp.auth_user_id = v_uid
    )
  order by ti.created_at desc;
end;
$$;

revoke all on function public.trip_pending_invites_for_current_user() from public;
grant execute on function public.trip_pending_invites_for_current_user() to authenticated;
grant execute on function public.trip_pending_invites_for_current_user() to service_role;
