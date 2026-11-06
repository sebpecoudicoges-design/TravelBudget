-- Replace one Trip edit, including its cash payment and personal share, in one transaction.
create or replace function public.trip_edit_expense_atomic_v1(
  p_trip_id uuid, p_payload jsonb, p_member_id uuid, p_wallet_id uuid,
  p_out_of_budget boolean, p_fx jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  eid uuid := (p_payload->>'expense_id')::uuid;
  v_kind text := p_payload->>'kind';
  amount numeric := (p_payload->>'amount')::numeric;
  currency_code text := upper(trim(p_payload->>'currency'));
  payer uuid := (p_payload->>'paid_by_member_id')::uuid;
  shares jsonb := p_payload->'shares';
  main_tx uuid;
  personal numeric;
  full_share boolean;
  leg record;
  tx uuid;
  title text;
begin
  if uid is null or not exists(select 1 from public.trip_participants
    where trip_id=p_trip_id and auth_user_id=uid and role in ('member','owner')) then
    raise exception 'Accès Trip refusé';
  end if;
  select transaction_id into main_tx from public.trip_expenses
    where trip_id=p_trip_id and id=eid for update;
  if not found then raise exception 'Dépense Trip introuvable'; end if;
  if v_kind is null or v_kind not in ('expense','income') or amount is null or amount<=0
    or p_out_of_budget is null or nullif(trim(p_payload->>'label'),'') is null then
    raise exception 'Dépense Trip invalide';
  end if;
  if p_member_id is not null and not exists(select 1 from public.trip_members m
    where m.trip_id=p_trip_id and m.id=p_member_id and (m.auth_user_id=uid or
      (m.auth_user_id is null and (m.user_id=uid or lower(m.email)=lower(auth.jwt()->>'email'))))) then
    raise exception 'Participant personnel invalide';
  end if;
  if exists(select 1 from public.trip_members m where m.trip_id=p_trip_id and m.auth_user_id=uid)
    and not exists(select 1 from public.trip_members m where m.trip_id=p_trip_id and m.auth_user_id=uid and m.id=p_member_id)
    then raise exception 'Participant personnel invalide'; end if;
  if jsonb_typeof(shares) is distinct from 'array' then raise exception 'Répartition requise'; end if;
  if exists(select 1 from jsonb_to_recordset(shares) s(member_id uuid,share_amount numeric)
    left join public.trip_members m on m.id=s.member_id and m.trip_id=p_trip_id
    where m.id is null or s.share_amount is null or s.share_amount<0)
    or exists(select 1 from jsonb_to_recordset(shares) s(member_id uuid)
      group by member_id having count(*)>1) then raise exception 'Répartition invalide'; end if;
  select coalesce(sum(share_amount),0) into personal from jsonb_to_recordset(shares)
    s(member_id uuid,share_amount numeric) where member_id=p_member_id;
  full_share := abs(personal-amount)<0.005;
  if (payer=p_member_id or personal>0) and p_wallet_id is null then raise exception 'Wallet requise pour cette écriture'; end if;
  if p_wallet_id is not null and not exists(select 1 from public.wallets where
    id=p_wallet_id and user_id=uid and upper(currency)=currency_code) then raise exception 'Wallet invalide'; end if;

  -- V2 replaces every budget link for this expense. Never discard another user's approved link.
  if exists(select 1 from public.trip_expense_budget_links where expense_id=eid and user_id<>uid)
    or exists(select 1 from public.transactions where id=main_tx and user_id<>uid) then
    raise exception 'Cette dépense comporte une écriture validée par un autre participant.';
  end if;
  for tx in select distinct transaction_id from public.trip_expense_budget_links
    where expense_id=eid and user_id=uid and transaction_id is distinct from main_tx
  loop
    perform public.delete_transaction(tx);
  end loop;
  perform public.trip_apply_expense_v2(p_trip_id,jsonb_set(p_payload,'{wallet_tx}','{"enabled":false}'));
  update public.trip_expenses set kind=v_kind,
    income_source=coalesce(p_payload->>'income_source','external'),
    income_due_back=coalesce((p_payload->>'income_due_back')::boolean,true)
    where id=eid and trip_id=p_trip_id;

  for leg in select true as cash, amount as value where payer=p_member_id
    union all select false,personal where p_wallet_id is not null and personal>0
      and not (payer=p_member_id and full_share)
  loop
    title := '[Trip] ' || case when leg.cash and not full_share then
      case when v_kind='income' then 'Entree recue - ' else 'Avance - ' end
      when v_kind='income' then case when leg.cash then 'Entree - ' else 'Part entree - ' end
      else '' end || trim(p_payload->>'label');
    tx := public.apply_transaction_v2(p_wallet_id=>p_wallet_id,p_type=>v_kind,p_label=>title,
      p_amount=>leg.value,p_currency=>currency_code,p_date_start=>(p_payload->>'date')::date,
      p_date_end=>(p_payload->>'date')::date,p_category=>p_payload->>'category',
      p_subcategory=>p_payload->>'subcategory',p_pay_now=>leg.cash,
      p_out_of_budget=>p_out_of_budget or (leg.cash and not full_share),
      p_affects_budget=>not p_out_of_budget and (not leg.cash or full_share),
      p_trip_expense_id=>case when leg.cash then eid end,
      p_budget_date_start=>(p_payload->>'budget_date_start')::date,
      p_budget_date_end=>(p_payload->>'budget_date_end')::date,
      p_fx_rate_snapshot=>(p_fx->>'p_fx_rate_snapshot')::numeric,
      p_fx_source_snapshot=>p_fx->>'p_fx_source_snapshot',
      p_fx_snapshot_at=>(p_fx->>'p_fx_snapshot_at')::timestamptz,
      p_fx_base_currency_snapshot=>p_fx->>'p_fx_base_currency_snapshot',
      p_fx_tx_currency_snapshot=>p_fx->>'p_fx_tx_currency_snapshot');
    if leg.cash then
      update public.trip_expenses set transaction_id=tx where id=eid;
    else
      update public.transactions set is_internal=true where id=tx and user_id=uid;
      insert into public.trip_expense_budget_links(user_id,trip_id,expense_id,member_id,transaction_id)
        values(uid,p_trip_id,eid,p_member_id,tx);
    end if;
  end loop;
  return eid;
end; $$;
revoke all on function public.trip_edit_expense_atomic_v1(uuid,jsonb,uuid,uuid,boolean,jsonb) from public,anon;
grant execute on function public.trip_edit_expense_atomic_v1(uuid,jsonb,uuid,uuid,boolean,jsonb) to authenticated;
