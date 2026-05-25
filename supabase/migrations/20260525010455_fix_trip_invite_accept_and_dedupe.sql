grant execute on function public.accept_trip_invite(text) to authenticated;
grant execute on function public.accept_trip_invite(text) to service_role;
grant execute on function public.trip_accept_invite(text) to authenticated;
grant execute on function public.trip_accept_invite(text) to service_role;

drop function if exists public.trip_pending_invites_for_current_user();

create or replace function public.trip_pending_invites_for_current_user()
returns table (
  token text,
  trip_id uuid,
  trip_name text,
  member_id uuid,
  member_name text,
  role text,
  inviter_email text,
  inviter_name text,
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
  with ranked as (
    select
      ti.*,
      tm.name as member_name,
      tm.email as member_email,
      tg.name as trip_name,
      cu.email as inviter_email,
      cp.email as inviter_profile_email,
      row_number() over (
        partition by ti.trip_id, ti.member_id
        order by ti.created_at desc
      ) as rn
    from public.trip_invites ti
    join public.trip_members tm
      on tm.id = ti.member_id
     and tm.trip_id = ti.trip_id
    join public.trip_groups tg
      on tg.id = ti.trip_id
    left join auth.users cu
      on cu.id = ti.created_by
    left join public.profiles cp
      on cp.id = ti.created_by
    where ti.used_at is null
      and ti.expires_at > now()
      and lower(trim(coalesce(tm.email, ''))) = v_email
      and not exists (
        select 1
        from public.trip_participants tp
        where tp.trip_id = ti.trip_id
          and tp.auth_user_id = v_uid
      )
  )
  select
    r.token::text,
    r.trip_id,
    coalesce(r.trip_name, 'Trip')::text as trip_name,
    r.member_id,
    coalesce(r.member_name, 'Participant')::text as member_name,
    coalesce(r.role, 'member')::text as role,
    coalesce(r.inviter_profile_email, r.inviter_email, '')::text as inviter_email,
    coalesce(r.inviter_profile_email, r.inviter_email, 'TravelBudget')::text as inviter_name,
    r.expires_at,
    r.created_at
  from ranked r
  where r.rn = 1
  order by r.created_at desc;
end;
$$;

revoke all on function public.trip_pending_invites_for_current_user() from public;
grant execute on function public.trip_pending_invites_for_current_user() to authenticated;
grant execute on function public.trip_pending_invites_for_current_user() to service_role;
