-- Run through an administrative SQL connection. All test writes roll back.
-- Requires an existing member with a wallet and another member in the same Trip.
begin;
do $$
declare
  f record;
  event_id uuid := gen_random_uuid();
  failed_id uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  tx_id uuid;
  result_id uuid;
  rejected boolean;
begin
  select w.id wallet_id,w.user_id,m.trip_id,m.id to_id,other.id from_id into f
  from public.wallets w join public.trip_members m on m.auth_user_id=w.user_id
  join public.trip_participants p on p.trip_id=m.trip_id and p.auth_user_id=w.user_id and p.role in ('owner','member')
  join public.trip_members other on other.trip_id=m.trip_id and other.id<>m.id and other.auth_user_id is distinct from w.user_id
  where w.period_id is not null limit 1;
  if not found then raise exception 'Test fixture unavailable'; end if;
  perform set_config('request.jwt.claim.sub',f.user_id::text,true);
  result_id := public.trip_apply_settlement_v2(event_id,f.trip_id,'AUD',50,f.from_id,f.to_id,f.wallet_id,'AUD',50,current_date);
  if result_id<>event_id then raise exception 'Wrong event id'; end if;
  perform public.trip_apply_settlement_v2(event_id,f.trip_id,'AUD',50,f.from_id,f.to_id,f.wallet_id,'AUD',50,current_date);
  select transaction_id into tx_id from public.trip_settlement_events where id=event_id;
  if tx_id is null or (select count(*) from public.transactions where offline_dedupe_key='trip-settlement:'||event_id::text)<>1 then
    raise exception 'Retry duplicated or omitted wallet transaction';
  end if;
  rejected := false;
  begin
    perform public.trip_apply_settlement_v2(event_id,f.trip_id,'AUD',51,f.from_id,f.to_id,f.wallet_id,'AUD',51,current_date);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Changed payload reused request id'; end if;

  rejected := false;
  begin
    perform public.trip_apply_settlement_v2(failed_id,f.trip_id,'AUD',50,f.from_id,f.to_id,f.wallet_id,'AUD',50,current_date,'{"p_fx_rate_snapshot":"invalid"}');
  exception when invalid_text_representation then rejected := true; end;
  if not rejected or exists(select 1 from public.trip_settlement_events where id=failed_id) then
    raise exception 'Wallet error left a partial event';
  end if;

  perform set_config('request.jwt.claim.sub',outsider::text,true);
  rejected := false;
  begin perform public.trip_cancel_settlement_v1(event_id); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Outsider cancelled payment'; end if;
  rejected := false;
  begin perform public.trip_apply_settlement_v2(failed_id,f.trip_id,'AUD',50,f.from_id,f.to_id); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Outsider created payment'; end if;
  perform set_config('request.jwt.claim.sub',f.user_id::text,true);
  perform public.trip_cancel_settlement_v1(event_id);
  perform public.trip_cancel_settlement_v1(event_id);
  if exists(select 1 from public.transactions where id=tx_id) or exists(select 1 from public.trip_settlement_events where id=event_id and cancelled_at is null) then
    raise exception 'Cancellation did not reverse both sides';
  end if;
  rejected := false;
  begin perform public.trip_apply_settlement_v2(event_id,f.trip_id,'AUD',50,f.from_id,f.to_id,f.wallet_id,'AUD',50,current_date); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Retry recreated cancelled payment'; end if;
  perform public.trip_apply_settlement_v2(failed_id,f.trip_id,'AUD',50,f.from_id,f.to_id);
  if exists(select 1 from public.trip_settlement_events where id=failed_id and transaction_id is not null) then raise exception 'Unexpected wallet write'; end if;
  perform public.trip_cancel_settlement_v1(failed_id);
  if has_function_privilege('anon','public.trip_apply_settlement_v2(uuid,uuid,text,numeric,uuid,uuid,uuid,text,numeric,date,jsonb)','execute') then raise exception 'Anonymous access granted'; end if;
end;
$$;
rollback;
select 'trip settlement regression checks passed; all writes rolled back' as result;
