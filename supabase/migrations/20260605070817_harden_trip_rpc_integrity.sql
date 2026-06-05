-- Harden Trip RPC integrity through table-level guards and a stricter member
-- binding RPC. These checks protect both SECURITY DEFINER RPCs and direct table
-- writes allowed by RLS.

alter table public.trip_expenses
  drop constraint if exists trip_expenses_amount_positive;
alter table public.trip_expenses
  add constraint trip_expenses_amount_positive check (amount > 0) not valid;
alter table public.trip_expenses
  validate constraint trip_expenses_amount_positive;

alter table public.trip_expense_shares
  drop constraint if exists trip_expense_shares_amount_non_negative;
alter table public.trip_expense_shares
  add constraint trip_expense_shares_amount_non_negative check (share_amount >= 0) not valid;
alter table public.trip_expense_shares
  validate constraint trip_expense_shares_amount_non_negative;

alter table public.trip_settlement_events
  drop constraint if exists trip_settlement_events_amount_positive;
alter table public.trip_settlement_events
  add constraint trip_settlement_events_amount_positive check (amount > 0) not valid;
alter table public.trip_settlement_events
  validate constraint trip_settlement_events_amount_positive;

alter table public.trip_settlement_events
  drop constraint if exists trip_settlement_events_distinct_members;
alter table public.trip_settlement_events
  add constraint trip_settlement_events_distinct_members check (from_member_id <> to_member_id) not valid;
alter table public.trip_settlement_events
  validate constraint trip_settlement_events_distinct_members;

create or replace function public.trip_validate_expense_share_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.trip_id is null or new.expense_id is null or new.member_id is null then
    raise exception 'Trip share requires trip_id, expense_id and member_id';
  end if;

  if coalesce(new.share_amount, 0) < 0 then
    raise exception 'Trip share amount must be non-negative';
  end if;

  if not exists (
    select 1
    from public.trip_expenses e
    where e.id = new.expense_id
      and e.trip_id = new.trip_id
  ) then
    raise exception 'Trip share expense does not belong to trip';
  end if;

  if not exists (
    select 1
    from public.trip_members m
    where m.id = new.member_id
      and m.trip_id = new.trip_id
  ) then
    raise exception 'Trip share member does not belong to trip';
  end if;

  return new;
end;
$function$;

drop trigger if exists trip_expense_shares_integrity_guard on public.trip_expense_shares;
create trigger trip_expense_shares_integrity_guard
before insert or update on public.trip_expense_shares
for each row execute function public.trip_validate_expense_share_integrity();

create or replace function public.trip_validate_settlement_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.trip_id is null or new.from_member_id is null or new.to_member_id is null then
    raise exception 'Trip settlement requires trip_id, from_member_id and to_member_id';
  end if;

  if coalesce(new.amount, 0) <= 0 then
    raise exception 'Trip settlement amount must be positive';
  end if;

  if nullif(trim(coalesce(new.currency, '')), '') is null then
    raise exception 'Trip settlement currency is required';
  end if;

  if new.from_member_id = new.to_member_id then
    raise exception 'Trip settlement members must be different';
  end if;

  if not exists (
    select 1
    from public.trip_members m
    where m.id = new.from_member_id
      and m.trip_id = new.trip_id
  ) then
    raise exception 'Settlement source member does not belong to trip';
  end if;

  if not exists (
    select 1
    from public.trip_members m
    where m.id = new.to_member_id
      and m.trip_id = new.trip_id
  ) then
    raise exception 'Settlement destination member does not belong to trip';
  end if;

  new.currency := upper(trim(new.currency));
  return new;
end;
$function$;

drop trigger if exists trip_settlement_events_integrity_guard on public.trip_settlement_events;
create trigger trip_settlement_events_integrity_guard
before insert or update on public.trip_settlement_events
for each row execute function public.trip_validate_settlement_integrity();

create or replace function public.bind_trip_member_to_auth(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_trip_id is null then
    raise exception 'trip_id required';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'not participant';
  end if;

  select id into v_member_id
  from public.trip_members
  where trip_id = p_trip_id
    and auth_user_id = v_uid
  limit 1;

  if v_member_id is not null then
    update public.trip_members
    set user_id = v_uid,
        email = coalesce(nullif(v_email,''), email)
    where id = v_member_id;
    return v_member_id;
  end if;

  if v_email <> '' then
    select id into v_member_id
    from public.trip_members
    where trip_id = p_trip_id
      and lower(email) = v_email
      and auth_user_id is null
    order by created_at asc
    limit 1;

    if v_member_id is not null then
      update public.trip_members
      set auth_user_id = v_uid,
          user_id = v_uid,
          email = v_email
      where id = v_member_id;

      return v_member_id;
    end if;
  end if;

  insert into public.trip_members(trip_id, auth_user_id, user_id, name, email, is_me)
  values (
    p_trip_id,
    v_uid,
    v_uid,
    coalesce(nullif(v_email,''), 'Me'),
    nullif(v_email,''),
    false
  )
  on conflict on constraint trip_members_trip_auth_user_key
  do update set
    auth_user_id = excluded.auth_user_id,
    user_id = excluded.user_id,
    email = coalesce(excluded.email, public.trip_members.email)
  returning id into v_member_id;

  return v_member_id;
end;
$function$;

create or replace function public.trip_bind_member_to_auth(p_trip_id uuid)
returns uuid
language sql
security definer
set search_path to 'public'
as $function$
  select public.bind_trip_member_to_auth(p_trip_id);
$function$;

create or replace function public.trip_accept_invite(p_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform *
  from public.accept_trip_invite(p_token);
end;
$function$;
