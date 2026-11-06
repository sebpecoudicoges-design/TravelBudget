-- Existing membership references only. All expense, allocation and cash rows are synthetic.
begin;
do $test$
declare
  f record;
  eid uuid := gen_random_uuid();
  payload jsonb;
  old_cash uuid;
  old_share uuid;
  rejected boolean;
  excluded boolean;
  foreign_wallet record;
  foreign_tx uuid := gen_random_uuid();
begin
  select w.id wallet,w.currency,w.user_id,m.trip_id,m.id me,n.id other into strict f
    from public.wallets w join public.trip_members m on m.auth_user_id=w.user_id
    join public.trip_participants p on p.trip_id=m.trip_id and p.auth_user_id=w.user_id and p.role in ('owner','member')
    join public.trip_members n on n.trip_id=m.trip_id and n.id<>m.id where w.period_id is not null limit 1;
  perform set_config('request.jwt.claim.sub',f.user_id::text,true);
  insert into public.trip_expenses(id,user_id,trip_id,paid_by_member_id,date,label,amount,currency)
    values(eid,f.user_id,f.trip_id,f.me,current_date,'audit',100,f.currency);
  payload := jsonb_build_object('expense_id',eid,'date',current_date,'label','audit','kind','expense','amount',100,
    'category','Autre','currency',f.currency,'paid_by_member_id',f.me,'shares',jsonb_build_array(
    jsonb_build_object('member_id',f.me,'share_amount',40),jsonb_build_object('member_id',f.other,'share_amount',60)));
  foreach excluded in array array[false,true,false] loop
    perform public.trip_edit_expense_atomic_v1(f.trip_id,payload,f.me,f.wallet,excluded);
    select t.id into strict old_cash from public.trip_expenses e join public.transactions t on t.id=e.transaction_id
      where e.id=eid and t.amount=100 and t.pay_now and t.out_of_budget and not t.affects_budget;
    select t.id into strict old_share from public.trip_expense_budget_links l join public.transactions t on t.id=l.transaction_id
      where l.expense_id=eid and t.amount=40 and t.is_internal and not t.pay_now
        and t.affects_budget=not excluded and t.out_of_budget=excluded;
    if (select count(*) from public.transactions where trip_expense_id=eid)<>1 then raise exception 'duplicate payment'; end if;
  end loop;
  rejected := false;
  begin
    perform public.trip_edit_expense_atomic_v1(f.trip_id,payload||'{"label":"failed edit"}',f.me,f.wallet,false,
      '{"p_fx_rate_snapshot":"bad"}');
  exception when invalid_text_representation then rejected:=true; end;
  if not rejected or not exists(select 1 from public.trip_expenses where id=eid and transaction_id=old_cash and label='audit')
    or not exists(select 1 from public.transactions where id=old_cash)
    or not exists(select 1 from public.trip_expense_budget_links l join public.transactions t on l.transaction_id=t.id
      where t.id=old_share and l.expense_id=eid)
    or (select sum(share_amount) from public.trip_expense_shares where expense_id=eid)<>100
    then raise exception 'Incomplete rollback'; end if;
  -- Another payer creates only a personal budget line. Old payment and quote-part disappear.
  perform public.trip_edit_expense_atomic_v1(f.trip_id,payload||jsonb_build_object('paid_by_member_id',f.other,'kind','income'),f.me,f.wallet,false);
  if exists(select 1 from public.transactions where id in (old_cash,old_share) or trip_expense_id=eid)
    or not exists(select 1 from public.trip_expense_budget_links l join public.transactions t on t.id=l.transaction_id
      where l.expense_id=eid and t.type='income' and t.amount=40 and not t.pay_now and t.affects_budget)
    then raise exception 'Wrong payer transition'; end if;
  -- The full personal share is both the only cash row and the budget line.
  payload := jsonb_set(payload,'{shares,0,share_amount}','100');
  payload := jsonb_set(payload,'{shares,1,share_amount}','0');
  perform public.trip_edit_expense_atomic_v1(f.trip_id,payload,f.me,f.wallet,false);
  if not exists(select 1 from public.transactions t join public.trip_expenses e on e.transaction_id=t.id
    where e.id=eid and t.amount=100 and t.pay_now and t.affects_budget and not t.out_of_budget)
    or exists(select 1 from public.trip_expense_budget_links where expense_id=eid) then raise exception 'Full share counted twice or missing'; end if;
  payload := jsonb_set(payload,'{shares,0,share_amount}','0');
  payload := jsonb_set(payload,'{shares,1,share_amount}','100');
  perform public.trip_edit_expense_atomic_v1(f.trip_id,payload,f.me,f.wallet,false);
  if not exists(select 1 from public.transactions where trip_expense_id=eid and amount=100 and pay_now and not affects_budget)
    or exists(select 1 from public.trip_expense_budget_links where expense_id=eid) then raise exception 'Unexpected budget charge for zero share'; end if;
  select id,user_id,period_id,currency into strict foreign_wallet from public.wallets
    where user_id<>f.user_id and period_id is not null limit 1;
  insert into public.transactions(id,user_id,wallet_id,period_id,type,amount,currency,category,label,
    date_start,date_end,budget_date_start,budget_date_end,pay_now,is_internal)
    values(foreign_tx,foreign_wallet.user_id,foreign_wallet.id,foreign_wallet.period_id,'expense',10,
      foreign_wallet.currency,'Autre','synthetic approval',current_date,current_date,current_date,current_date,false,true);
  insert into public.trip_expense_budget_links(user_id,trip_id,expense_id,member_id,transaction_id)
    values(foreign_wallet.user_id,f.trip_id,eid,f.other,foreign_tx);
  rejected := false;
  begin perform public.trip_edit_expense_atomic_v1(f.trip_id,payload,f.me,f.wallet,false);
  exception when others then if sqlerrm not like 'Cette dépense comporte%' then raise; end if; rejected:=true; end;
  if not rejected or not exists(select 1 from public.trip_expense_budget_links where transaction_id=foreign_tx and expense_id=eid)
    then raise exception 'Other account approval not preserved'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rejected := false;
  begin perform public.trip_edit_expense_atomic_v1(f.trip_id,payload,f.me,f.wallet,false);
  exception when others then if sqlerrm<>'Accès Trip refusé' then raise; end if; rejected:=true; end;
  if not rejected then raise exception 'Outsider allowed'; end if;
end;
$test$;
rollback;
select 'trip atomic edit regression passed; writes rolled back' as result;
