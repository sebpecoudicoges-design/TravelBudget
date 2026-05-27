create or replace function public.trip_accept_payer_approval(p_inbox_id uuid, p_wallet_id uuid)
returns table (
  payment_transaction_id uuid,
  share_transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := '';
  v_item public.inbox_items%rowtype;
  v_exp public.trip_expenses%rowtype;
  v_member public.trip_members%rowtype;
  v_wallet public.wallets%rowtype;
  v_share_tx uuid := null;
  v_share_amount numeric := null;
  v_category text;
  v_subcategory text;
  v_budget_start date;
  v_budget_end date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select lower(trim(coalesce(u.email, '')))
    into v_email
  from auth.users u
  where u.id = v_uid;

  select *
    into v_item
  from public.inbox_items
  where id = p_inbox_id
    and user_id = v_uid
    and source = 'trip_payer_approval'
    and target_type = 'trip_expense'
    and status in ('pending', 'snoozed')
  for update;

  if not found then
    raise exception 'Approval request not found';
  end if;

  select *
    into v_exp
  from public.trip_expenses
  where id = v_item.target_id;

  if not found then
    raise exception 'Trip expense not found';
  end if;

  select *
    into v_member
  from public.trip_members
  where id = v_exp.paid_by_member_id
    and trip_id = v_exp.trip_id;

  if not found then
    raise exception 'Payer member not found';
  end if;

  if coalesce(v_member.auth_user_id, v_uid) <> v_uid
     and lower(trim(coalesce(v_member.email, ''))) <> v_email then
    raise exception 'Current user is not the declared payer';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = p_wallet_id
    and user_id = v_uid
    and archived is not true;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if upper(coalesce(v_wallet.currency, '')) <> upper(coalesce(v_exp.currency, '')) then
    raise exception 'Wallet currency does not match expense currency';
  end if;

  select s.share_amount
    into v_share_amount
  from public.trip_expense_shares s
  where s.expense_id = v_exp.id
    and s.member_id = v_member.id
  limit 1;

  v_share_amount := coalesce(v_share_amount, 0);
  v_category := coalesce(nullif(v_exp.category, ''), 'Autre');
  v_subcategory := nullif(v_exp.subcategory, '');
  v_budget_start := coalesce(v_exp.budget_date_start, v_exp.date);
  v_budget_end := coalesce(v_exp.budget_date_end, v_budget_start);

  if v_share_amount > 0 and not exists (
    select 1
    from public.trip_expense_budget_links l
    where l.expense_id = v_exp.id
      and l.member_id = v_member.id
  ) then
    v_share_tx := public.apply_transaction_v2(
      p_wallet_id => p_wallet_id,
      p_type => 'expense',
      p_label => '[Trip] ' || v_exp.label,
      p_amount => v_share_amount,
      p_currency => v_exp.currency,
      p_date_start => v_exp.date,
      p_date_end => v_exp.date,
      p_category => v_category,
      p_subcategory => v_subcategory,
      p_pay_now => false,
      p_out_of_budget => false,
      p_night_covered => false,
      p_affects_budget => true,
      p_trip_expense_id => null,
      p_trip_share_link_id => null,
      p_fx_rate_snapshot => null,
      p_fx_source_snapshot => null,
      p_fx_snapshot_at => null,
      p_fx_base_currency_snapshot => null,
      p_fx_tx_currency_snapshot => null,
      p_user_id => v_uid,
      p_budget_date_start => v_budget_start,
      p_budget_date_end => v_budget_end
    );

    update public.transactions
      set is_internal = true
    where id = v_share_tx
      and user_id = v_uid;

    insert into public.trip_expense_budget_links (
      user_id,
      trip_id,
      expense_id,
      member_id,
      transaction_id
    )
    values (
      v_uid,
      v_exp.trip_id,
      v_exp.id,
      v_member.id,
      v_share_tx
    )
    on conflict (expense_id, member_id) do nothing;
  else
    select l.transaction_id
      into v_share_tx
    from public.trip_expense_budget_links l
    where l.expense_id = v_exp.id
      and l.member_id = v_member.id
    limit 1;
  end if;

  update public.inbox_items
    set status = 'processed',
        processed_at = now(),
        error_message = null
  where id = v_item.id;

  payment_transaction_id := null;
  share_transaction_id := v_share_tx;
  return next;
end;
$$;

revoke all on function public.trip_accept_payer_approval(uuid, uuid) from public;
grant execute on function public.trip_accept_payer_approval(uuid, uuid) to authenticated;
grant execute on function public.trip_accept_payer_approval(uuid, uuid) to service_role;
