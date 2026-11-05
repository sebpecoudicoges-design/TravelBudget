-- Administrative regression test. Synthetic transactions only; all writes roll back.
begin;
do $test$
declare
  f record;
  tx uuid;
  r record;
  actual public.transactions%rowtype;
  excluded boolean;
  rejected boolean;
  member record;
  expense uuid;
  source text;
begin
  select id, user_id, period_id, currency into f from public.wallets limit 1;
  if not found then raise exception 'Wallet fixture unavailable'; end if;
  perform set_config('request.jwt.claim.sub', f.user_id::text, true);
  for r in select * from (values
    ('expense', true, false, 'audit ordinary', 'Autre', true),
    ('expense', false, false, 'audit planned', 'Autre', true),
    ('income', true, false, 'audit income', 'Autre', true),
    ('expense', true, true, 'audit internal', 'Autre', false),
    ('expense', true, false, '[Trip] Avance - audit', 'Autre', false),
    ('expense', false, true, '[Trip] quote-part audit', 'Autre', false),
    ('expense', true, false, 'audit adjustment', 'Ajustement wallet', false)
  ) as cases(kind, paid, internal, label, category, expected) loop
    tx := gen_random_uuid();
    insert into public.transactions(id,user_id,wallet_id,period_id,type,amount,currency,
      category,label,date_start,date_end,budget_date_start,budget_date_end,
      pay_now,out_of_budget,affects_budget,is_internal)
    values(tx,f.user_id,f.id,f.period_id,r.kind,12.34,f.currency,r.category,r.label,
      current_date,current_date,current_date,current_date,r.paid,false,true,r.internal);
    -- Full round trip and a repeated edit after re-entry. Cash flags never change.
    foreach excluded in array array[true,false,false] loop
      perform public.update_transaction_v2(
        p_id=>tx,p_wallet_id=>f.id,p_type=>r.kind,p_amount=>12.34,p_currency=>f.currency,
        p_category=>r.category,p_label=>r.label,p_date_start=>current_date,p_date_end=>current_date,
        p_pay_now=>r.paid,p_out_of_budget=>excluded);
      select * into actual from public.transactions where id=tx;
      if actual.affects_budget is distinct from (not excluded and r.expected)
        or actual.out_of_budget is distinct from excluded
        or actual.pay_now is distinct from r.paid or actual.amount<>12.34
        or actual.is_internal is distinct from r.internal then
        raise exception 'Budget/cash regression: %, excluded=%',r.label,excluded;
      end if;
    end loop;
    perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
    rejected := false;
    begin
      perform public.update_transaction_v2(tx,f.id,r.kind,12.34,f.currency,r.category,r.label,current_date,current_date);
    exception when others then
      if sqlerrm <> 'Transaction introuvable' then raise; end if;
      rejected := true;
    end;
    if not rejected then raise exception 'Other user edited transaction'; end if;
    perform set_config('request.jwt.claim.sub',f.user_id::text,true);
  end loop;
  select m.id,m.trip_id into member from public.trip_members m where m.auth_user_id=f.user_id limit 1;
  if not found then raise exception 'Trip member fixture unavailable'; end if;
  foreach source in array array['direct','reverse','share'] loop
    tx := gen_random_uuid();
    expense := gen_random_uuid();
    insert into public.trip_expenses(id,user_id,trip_id,paid_by_member_id,date,label,amount,currency)
    values(expense,f.user_id,member.trip_id,member.id,current_date,'audit synthetic',12.34,f.currency);
    insert into public.transactions(id,user_id,wallet_id,period_id,type,amount,currency,
      category,label,date_start,date_end,budget_date_start,budget_date_end,
      pay_now,out_of_budget,affects_budget,trip_expense_id)
    values(tx,f.user_id,f.id,f.period_id,'expense',12.34,f.currency,'Autre','audit source link',
      current_date,current_date,current_date,current_date,true,true,false,
      case when source='direct' then expense else null end);
    if source='reverse' then
      update public.trip_expenses set transaction_id=tx where id=expense;
    elsif source='share' then
      insert into public.trip_expense_budget_links(user_id,trip_id,expense_id,member_id,transaction_id)
      values(f.user_id,member.trip_id,expense,member.id,tx);
    end if;
    perform public.update_transaction_v2(tx,f.id,'expense',12.34,f.currency,'Autre','audit source link',
      current_date,current_date,true,false,false,f.user_id,null,
      case when source='direct' then expense else null end);
    if (select affects_budget from public.transactions where id=tx) then
      raise exception 'Source-managed transaction reactivated: %',source;
    end if;
  end loop;
end;
$test$;
rollback;
select 'budget re-entry checks passed; all writes rolled back' as result;
