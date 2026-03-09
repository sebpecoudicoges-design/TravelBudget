create or replace function public.trip_delete_expense_v1(p_trip_id uuid, p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_uid uuid;
  v_main_tx_id uuid;
  v_budget_tx_ids uuid[] := '{}'::uuid[];
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'not authorized';
  end if;

  select
    e.transaction_id,
    coalesce(array_agg(distinct l.transaction_id) filter (where l.transaction_id is not null), '{}'::uuid[])
  into v_main_tx_id, v_budget_tx_ids
  from public.trip_expenses e
  left join public.trip_expense_budget_links l
    on l.expense_id = e.id
   and l.trip_id = e.trip_id
  where e.id = p_expense_id
    and e.trip_id = p_trip_id
  group by e.id, e.transaction_id
  for update of e;

  if not found then
    raise exception 'expense not found';
  end if;

  -- Break direct links before deleting dependent rows/transactions.
  if v_main_tx_id is not null then
    update public.trip_expenses
    set transaction_id = null
    where id = p_expense_id
      and trip_id = p_trip_id;

    update public.transactions
    set trip_expense_id = null
    where id = v_main_tx_id
      and user_id = v_uid;
  end if;

  -- Remove budget-link rows first; transactions.trip_share_link_id is ON DELETE SET NULL.
  delete from public.trip_expense_budget_links
  where expense_id = p_expense_id
    and trip_id = p_trip_id;

  delete from public.trip_expense_shares
  where expense_id = p_expense_id
    and trip_id = p_trip_id;

  delete from public.trip_expenses
  where id = p_expense_id
    and trip_id = p_trip_id;

  if coalesce(array_length(v_budget_tx_ids, 1), 0) > 0 then
    update public.transactions
    set trip_share_link_id = null
    where id = any(v_budget_tx_ids)
      and user_id = v_uid;

    delete from public.transactions t
    where t.id = any(v_budget_tx_ids)
      and t.user_id = v_uid;
  end if;

  if v_main_tx_id is not null then
    delete from public.transactions t
    where t.id = v_main_tx_id
      and t.user_id = v_uid;
  end if;
end;
$$;
