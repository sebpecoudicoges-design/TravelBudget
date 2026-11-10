-- Only synthetic Trips and transactions are written. All changes roll back.
begin;
do $test$
declare
  w record;
  gid uuid := gen_random_uuid();
  other_gid uuid := gen_random_uuid();
  mid uuid := gen_random_uuid();
  eid uuid := gen_random_uuid();
  tid uuid := gen_random_uuid();
  share_tx uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  member_uid uuid;
  rejected boolean;
  checkpoint text;
  original text;
  injected text;
begin
  select * into strict w from public.wallets where period_id is not null limit 1;
  select id into strict member_uid from auth.users where id<>w.user_id limit 1;
  perform set_config('request.jwt.claim.sub',w.user_id::text,true);
  insert into public.trip_groups(id,user_id,name,base_currency) values
    (gid,w.user_id,'audit delete',w.currency),(other_gid,w.user_id,'audit other',w.currency);
  insert into public.trip_participants(trip_id,auth_user_id,role) values(gid,member_uid,'member');
  insert into public.trip_members(id,trip_id,user_id,name) values(mid,gid,w.user_id,'audit');
  insert into public.trip_expenses(id,trip_id,user_id,date,label,amount,currency,paid_by_member_id)
    values(eid,gid,w.user_id,current_date,'audit',100,w.currency,mid);
  insert into public.trip_expense_shares(trip_id,expense_id,member_id,user_id,share_amount)
    values(gid,eid,mid,w.user_id,40);
  insert into public.transactions(id,user_id,wallet_id,period_id,type,amount,currency,category,date_start,date_end,
    budget_date_start,budget_date_end,trip_expense_id,out_of_budget,affects_budget) values(tid,w.user_id,w.id,w.period_id,'expense',100,w.currency,
    'Autre',current_date,current_date,current_date,current_date,eid,true,false);
  insert into public.transactions(id,user_id,wallet_id,period_id,type,amount,currency,category,date_start,date_end,
    budget_date_start,budget_date_end,pay_now,is_internal,affects_budget)
    values(share_tx,w.user_id,w.id,w.period_id,'expense',40,w.currency,'Autre',current_date,current_date,
      current_date,current_date,false,true,true);
  insert into public.trip_expense_budget_links(user_id,trip_id,expense_id,member_id,transaction_id)
    values(w.user_id,gid,eid,mid,share_tx);
  update public.trip_expenses set transaction_id=tid where id=eid;
  foreach outsider in array array[member_uid,gen_random_uuid()] loop
    perform set_config('request.jwt.claim.sub',outsider::text,true);
    rejected:=false;
    begin perform public.trip_delete_group_v1(gid);
    exception when raise_exception then rejected:=sqlerrm='Trip introuvable ou suppression non autorisée'; end;
    if not rejected then raise exception 'Unauthorized deletion'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',w.user_id::text,true);
  -- Inject faults into a temporary copy, never the deployed function.
  original:=pg_get_functiondef('public.trip_delete_group_v1(uuid)'::regprocedure);
  foreach checkpoint in array array['  delete from public.trip_expenses','  delete from public.trip_groups','  return p_trip_id;'] loop
    injected:=replace(original,'FUNCTION public.trip_delete_group_v1','FUNCTION pg_temp.trip_delete_fail');
    injected:=replace(injected,checkpoint,'  raise exception ''injected'';'||chr(10)||checkpoint);
    execute injected;
    rejected:=false;
    begin perform pg_temp.trip_delete_fail(gid);
    exception when raise_exception then rejected:=sqlerrm='injected'; end;
    if not rejected or not exists(select from public.trip_groups where id=gid)
      or not exists(select from public.trip_members where id=mid)
      or not exists(select from public.trip_expense_shares where expense_id=eid)
      or not exists(select from public.trip_expenses where id=eid and transaction_id=tid)
      or not exists(select from public.transactions where id=tid and trip_expense_id=eid and not detached_trip_payment) then
      raise exception 'Incomplete rollback at %',checkpoint;
    end if;
  end loop;
  if public.trip_delete_group_v1(gid)<>gid then raise exception 'Wrong confirmation'; end if;
  if exists(select from public.trip_groups where id=gid) or exists(select from public.trip_members where id=mid)
    or exists(select from public.trip_expenses where id=eid) or exists(select from public.trip_expense_shares where expense_id=eid)
    or not exists(select from public.transactions where id=tid and wallet_id=w.id and amount=100 and trip_expense_id is null and detached_trip_payment and not affects_budget)
    or not exists(select from public.transactions where id=share_tx and amount=40 and not detached_trip_payment and affects_budget and not pay_now)
    or not exists(select from public.trip_groups where id=other_gid) then raise exception 'Wrong deletion scope'; end if;
  perform public.update_transaction_v2(tid,w.id,'expense',100,w.currency,'Autre','Restaurant',current_date,current_date,true,false);
  if not exists(select from public.transactions where id=tid and detached_trip_payment and not affects_budget) then
    raise exception 'Editing detached cash payment restored budget impact';
  end if;
end; $test$;
rollback;
select 'Trip deletion tests passed; all writes rolled back' as result;
