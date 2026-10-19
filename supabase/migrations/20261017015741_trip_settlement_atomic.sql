-- One request id represents one user intent, including retries after a lost response.
create or replace function public.trip_apply_settlement_v2(
  p_event_id uuid, p_trip_id uuid, p_currency text, p_amount numeric,
  p_from_member_id uuid, p_to_member_id uuid,
  p_wallet_id uuid default null, p_wallet_currency text default null,
  p_wallet_amount numeric default null, p_date date default null,
  p_fx jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.trip_settlement_events%rowtype;
  v_tx public.transactions%rowtype;
  v_tx_id uuid;
  v_from public.trip_members%rowtype;
  v_to public.trip_members%rowtype;
  v_type text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_event_id is null then raise exception 'Request id required'; end if;
  if not exists (select 1 from public.trip_participants where trip_id=p_trip_id and auth_user_id=v_uid and role in ('owner','member')) then
    raise exception 'Not participant';
  end if;
  select * into v_from from public.trip_members where id=p_from_member_id and trip_id=p_trip_id;
  select * into v_to from public.trip_members where id=p_to_member_id and trip_id=p_trip_id;
  if v_from.id is null or v_to.id is null or v_from.id=v_to.id or coalesce(p_amount,0)<=0
     or nullif(trim(p_currency),'') is null then raise exception 'Invalid settlement'; end if;
  if p_wallet_id is not null then
    if not exists (select 1 from public.wallets where id=p_wallet_id and user_id=v_uid)
       or (v_from.auth_user_id is distinct from v_uid and v_to.auth_user_id is distinct from v_uid) then
      raise exception 'Wallet not owned or user not involved';
    end if;
    if coalesce(p_wallet_amount,0)<=0 or p_date is null or nullif(trim(p_wallet_currency),'') is null then
      raise exception 'Invalid wallet settlement';
    end if;
    v_type := case when v_from.auth_user_id=v_uid then 'expense' else 'income' end;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text,0));
  select * into v_event from public.trip_settlement_events where id=p_event_id for update;
  if found then
    if v_event.created_by<>v_uid or v_event.trip_id<>p_trip_id
       or v_event.from_member_id<>p_from_member_id or v_event.to_member_id<>p_to_member_id
       or v_event.amount<>round(p_amount,2) or v_event.currency<>upper(trim(p_currency)) then
      raise exception 'Request id already used for another settlement';
    end if;
    if v_event.cancelled_at is not null then raise exception 'Settlement already cancelled'; end if;
    if p_wallet_id is not null then
      select * into v_tx from public.transactions where id=v_event.transaction_id;
      if v_tx.id is null or v_tx.user_id<>v_uid or v_tx.wallet_id<>p_wallet_id or v_tx.type<>v_type
         or v_tx.amount<>round(p_wallet_amount,2) or v_tx.currency<>upper(trim(p_wallet_currency)) or v_tx.date_start<>p_date then
        raise exception 'Request id already used with different wallet details';
      end if;
    elsif v_event.transaction_id is not null then raise exception 'Request already includes a wallet';
    end if;
    return p_event_id;
  end if;
  insert into public.trip_settlement_events(id,trip_id,currency,amount,from_member_id,to_member_id,created_by)
  values(p_event_id,p_trip_id,upper(trim(p_currency)),round(p_amount,2),p_from_member_id,p_to_member_id,v_uid);
  if p_wallet_id is not null then
    v_tx_id := public.apply_transaction_v2(
      p_wallet_id=>p_wallet_id, p_type=>v_type,
      p_label=>'[Trip] SETTLE:'||p_event_id::text||' • '||case when v_type='income' then 'Règlement reçu de '||v_from.name else 'Règlement à '||v_to.name end,
      p_amount=>round(p_wallet_amount,2), p_currency=>p_wallet_currency,
      p_date_start=>p_date, p_date_end=>p_date, p_category=>'Mouvement interne',
      p_pay_now=>true, p_out_of_budget=>true, p_affects_budget=>false,
      p_fx_rate_snapshot=>(p_fx->>'p_fx_rate_snapshot')::numeric,
      p_fx_source_snapshot=>p_fx->>'p_fx_source_snapshot',
      p_fx_snapshot_at=>(p_fx->>'p_fx_snapshot_at')::timestamptz,
      p_fx_base_currency_snapshot=>p_fx->>'p_fx_base_currency_snapshot',
      p_fx_tx_currency_snapshot=>p_fx->>'p_fx_tx_currency_snapshot',
      p_offline_dedupe_key=>'trip-settlement:'||p_event_id::text
    );
    update public.trip_settlement_events set transaction_id=v_tx_id where id=p_event_id;
  end if;
  return p_event_id;
end;
$$;

create or replace function public.trip_cancel_settlement_v1(p_event_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.trip_settlement_events%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_event from public.trip_settlement_events where id=p_event_id for update;
  if not found then raise exception 'Settlement not found'; end if;
  if not exists (select 1 from public.trip_participants where trip_id=v_event.trip_id and auth_user_id=v_uid
                 and (v_event.created_by=v_uid or role='owner')) then
    raise exception 'Only creator or trip owner can cancel';
  end if;
  -- Also repairs already-cancelled events from older clients. Never touch unrelated transactions.
  if v_event.transaction_id is not null then
    if exists (select 1 from public.transactions where id=v_event.transaction_id
               and (user_id is distinct from v_event.created_by or internal_transfer_id is not null)) then
      raise exception 'Settlement transaction owner mismatch';
    end if;
    delete from public.transactions where id=v_event.transaction_id and user_id=v_event.created_by;
  end if;
  update public.trip_settlement_events set cancelled_at=coalesce(cancelled_at,now()),transaction_id=null where id=p_event_id;
end;
$$;
revoke all on function public.trip_apply_settlement_v2(uuid,uuid,text,numeric,uuid,uuid,uuid,text,numeric,date,jsonb) from public,anon;
grant execute on function public.trip_apply_settlement_v2(uuid,uuid,text,numeric,uuid,uuid,uuid,text,numeric,date,jsonb) to authenticated;
revoke all on function public.trip_cancel_settlement_v1(uuid) from public,anon;
grant execute on function public.trip_cancel_settlement_v1(uuid) to authenticated;
