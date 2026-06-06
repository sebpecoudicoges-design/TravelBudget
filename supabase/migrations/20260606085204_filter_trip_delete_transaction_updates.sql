-- Keep trip_delete_expense_v1 aligned with the frontend/RLS behavior: the RPC
-- may remove the shared Trip expense, but it only mutates/deletes transactions
-- owned by the current user.

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
    and l.transaction_id is not null
    and l.user_id = v_uid;

  update public.trip_expenses te
  set transaction_id = null
  where te.id = p_expense_id
    and te.trip_id = p_trip_id;

  update public.transactions t
  set trip_expense_id = null,
      trip_share_link_id = null
  where t.user_id = v_uid
    and (
      t.trip_expense_id = p_expense_id
      or t.id = any(v_budget_tx_ids)
      or t.id = v_main_tx_id
    );

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
