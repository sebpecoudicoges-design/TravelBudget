-- Tighten Trip budget link integrity and make the Trip delete RPC safe to use
-- from the frontend again.

create or replace function public.trip_validate_budget_link_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.user_id is null or new.trip_id is null or new.expense_id is null or new.member_id is null or new.transaction_id is null then
    raise exception 'Trip budget link requires user_id, trip_id, expense_id, member_id and transaction_id';
  end if;

  if not exists (
    select 1
    from public.trip_expenses e
    where e.id = new.expense_id
      and e.trip_id = new.trip_id
  ) then
    raise exception 'Trip budget link expense does not belong to trip';
  end if;

  if not exists (
    select 1
    from public.trip_members m
    where m.id = new.member_id
      and m.trip_id = new.trip_id
  ) then
    raise exception 'Trip budget link member does not belong to trip';
  end if;

  if not exists (
    select 1
    from public.transactions t
    where t.id = new.transaction_id
      and t.user_id = new.user_id
  ) then
    raise exception 'Trip budget link transaction does not belong to user';
  end if;

  return new;
end;
$function$;

drop trigger if exists trip_expense_budget_links_integrity_guard on public.trip_expense_budget_links;
create trigger trip_expense_budget_links_integrity_guard
before insert or update on public.trip_expense_budget_links
for each row execute function public.trip_validate_budget_link_integrity();

revoke execute on function public.trip_validate_budget_link_integrity() from public;
revoke execute on function public.trip_validate_budget_link_integrity() from anon;
revoke execute on function public.trip_validate_budget_link_integrity() from authenticated;

create or replace function public.trip_delete_expense_v1(p_trip_id uuid, p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_main_tx_id uuid;
  v_budget_tx_ids uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_trip_id is null or p_expense_id is null then
    raise exception 'trip_id and expense_id required';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'not authorized';
  end if;

  select te.transaction_id
    into v_main_tx_id
  from public.trip_expenses te
  where te.id = p_expense_id
    and te.trip_id = p_trip_id
  for update;

  if not found then
    raise exception 'expense not found';
  end if;

  select coalesce(array_agg(distinct l.transaction_id), '{}')
    into v_budget_tx_ids
  from public.trip_expense_budget_links l
  join public.transactions t
    on t.id = l.transaction_id
   and t.user_id = l.user_id
  where l.trip_id = p_trip_id
    and l.expense_id = p_expense_id
    and l.transaction_id is not null;

  update public.trip_expenses te
  set transaction_id = null
  where te.id = p_expense_id
    and te.trip_id = p_trip_id;

  update public.transactions t
  set trip_expense_id = null,
      trip_share_link_id = null
  where t.trip_expense_id = p_expense_id
     or t.id = any(v_budget_tx_ids)
     or t.id = v_main_tx_id;

  delete from public.trip_expense_budget_links l
  where l.trip_id = p_trip_id
    and l.expense_id = p_expense_id;

  delete from public.trip_expense_shares s
  where s.trip_id = p_trip_id
    and s.expense_id = p_expense_id;

  delete from public.trip_expenses te
  where te.id = p_expense_id
    and te.trip_id = p_trip_id;

  if coalesce(array_length(v_budget_tx_ids, 1), 0) > 0 then
    delete from public.transactions t
    where t.id = any(v_budget_tx_ids)
      and t.user_id = v_uid;
  end if;

  if v_main_tx_id is not null
     and not (v_main_tx_id = any(v_budget_tx_ids)) then
    delete from public.transactions t
    where t.id = v_main_tx_id
      and t.user_id = v_uid;
  end if;
end;
$function$;

revoke all on function public.trip_delete_expense_v1(uuid, uuid) from public;
grant execute on function public.trip_delete_expense_v1(uuid, uuid) to authenticated;
grant execute on function public.trip_delete_expense_v1(uuid, uuid) to service_role;
