create or replace function public.trip_request_payer_approval(p_expense_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := '';
  v_exp public.trip_expenses%rowtype;
  v_trip public.trip_groups%rowtype;
  v_payer public.trip_members%rowtype;
  v_share record;
  v_target_uid uuid;
  v_first_item_id uuid := null;
  v_item_id uuid;
  v_source_message_id text;
  v_raw text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select lower(trim(coalesce(u.email, '')))
    into v_email
  from auth.users u
  where u.id = v_uid;

  select *
    into v_exp
  from public.trip_expenses
  where id = p_expense_id;

  if not found then
    raise exception 'Trip expense not found';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = v_exp.trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'Not a trip participant';
  end if;

  select *
    into v_trip
  from public.trip_groups
  where id = v_exp.trip_id;

  select *
    into v_payer
  from public.trip_members
  where id = v_exp.paid_by_member_id
    and trip_id = v_exp.trip_id;

  v_raw := 'Validation part Budget Trip - ' || coalesce(v_trip.name, 'Trip') || ' - ' || coalesce(v_exp.label, 'Dépense') || ' - ' || v_exp.amount::text || ' ' || v_exp.currency;

  for v_share in
    select
      s.member_id,
      s.share_amount,
      tm.name as member_name,
      tm.email as member_email,
      tm.auth_user_id as member_auth_user_id
    from public.trip_expense_shares s
    join public.trip_members tm
      on tm.id = s.member_id
     and tm.trip_id = s.trip_id
    where s.expense_id = v_exp.id
      and coalesce(s.share_amount, 0) > 0
  loop
    v_target_uid := v_share.member_auth_user_id;

    if v_target_uid is null and coalesce(v_share.member_email, '') <> '' then
      select u.id
        into v_target_uid
      from auth.users u
      where lower(u.email) = lower(trim(v_share.member_email))
      order by u.created_at desc
      limit 1;
    end if;

    if v_target_uid is null or v_target_uid = v_uid then
      continue;
    end if;

    if exists (
      select 1
      from public.trip_expense_budget_links l
      where l.expense_id = v_exp.id
        and l.member_id = v_share.member_id
    ) then
      continue;
    end if;

    v_source_message_id := 'trip-budget-share-approval:' || v_exp.id::text || ':' || v_share.member_id::text || ':' || v_target_uid::text;

    insert into public.inbox_items (
      user_id,
      travel_id,
      source,
      source_from,
      source_message_id,
      status,
      raw_text,
      media_count,
      media,
      target_type,
      target_id,
      snoozed_until,
      deleted_at,
      error_message
    )
    values (
      v_target_uid,
      null,
      'trip_payer_approval',
      v_email,
      v_source_message_id,
      'pending',
      v_raw,
      0,
      jsonb_build_object(
        'kind', 'trip_payer_approval',
        'trip_id', v_exp.trip_id,
        'trip_name', coalesce(v_trip.name, 'Trip'),
        'expense_id', v_exp.id,
        'expense_label', v_exp.label,
        'amount', v_exp.amount,
        'currency', v_exp.currency,
        'date', v_exp.date,
        'budget_date_start', v_exp.budget_date_start,
        'budget_date_end', v_exp.budget_date_end,
        'category', v_exp.category,
        'subcategory', v_exp.subcategory,
        'member_id', v_share.member_id,
        'member_name', v_share.member_name,
        'member_share_amount', v_share.share_amount,
        'payer_member_id', v_exp.paid_by_member_id,
        'payer_member_name', coalesce(v_payer.name, ''),
        'payer_share_amount', v_share.share_amount,
        'created_by', v_uid,
        'created_by_email', v_email
      ),
      'trip_expense',
      v_exp.id,
      null,
      null,
      null
    )
    on conflict (source_message_id) do update
      set status = 'pending',
          raw_text = excluded.raw_text,
          media = excluded.media,
          target_type = excluded.target_type,
          target_id = excluded.target_id,
          snoozed_until = null,
          deleted_at = null,
          error_message = null
    returning id into v_item_id;

    if v_first_item_id is null then
      v_first_item_id := v_item_id;
    end if;
  end loop;

  return v_first_item_id;
end;
$$;

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
  v_member_id uuid := null;
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

  v_member_id := nullif(v_item.media ->> 'member_id', '')::uuid;
  if v_member_id is null then
    v_member_id := v_exp.paid_by_member_id;
  end if;

  select *
    into v_member
  from public.trip_members
  where id = v_member_id
    and trip_id = v_exp.trip_id;

  if not found then
    raise exception 'Trip member not found';
  end if;

  if coalesce(v_member.auth_user_id, v_uid) <> v_uid
     and lower(trim(coalesce(v_member.email, ''))) <> v_email then
    raise exception 'Current user is not the target member';
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

revoke all on function public.trip_request_payer_approval(uuid) from public;
grant execute on function public.trip_request_payer_approval(uuid) to authenticated;
grant execute on function public.trip_request_payer_approval(uuid) to service_role;

revoke all on function public.trip_accept_payer_approval(uuid, uuid) from public;
grant execute on function public.trip_accept_payer_approval(uuid, uuid) to authenticated;
grant execute on function public.trip_accept_payer_approval(uuid, uuid) to service_role;
