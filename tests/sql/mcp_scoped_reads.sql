begin;
insert into auth.users(id) values ('a0020000-0000-4000-8000-000000000001'),('a0020000-0000-4000-8000-000000000002');
insert into public.travels(id,user_id,name) values
 ('a0020000-0000-4000-8000-000000000007','a0020000-0000-4000-8000-000000000001','Synthetic A'),
 ('a0020000-0000-4000-8000-000000000008','a0020000-0000-4000-8000-000000000002','Synthetic B');
insert into public.periods(id,user_id,travel_id,start_date,end_date,base_currency) values
 ('a0020000-0000-4000-8000-000000000003','a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000007','2026-01-01','2026-12-31','EUR'),
 ('a0020000-0000-4000-8000-000000000004','a0020000-0000-4000-8000-000000000002','a0020000-0000-4000-8000-000000000008','2026-01-01','2026-12-31','EUR');
insert into public.wallets(id,user_id,period_id,name,currency,balance) values
 ('a0020000-0000-4000-8000-000000000005','a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000003','Synthetic A','EUR',100),
 ('a0020000-0000-4000-8000-000000000006','a0020000-0000-4000-8000-000000000002','a0020000-0000-4000-8000-000000000004','Synthetic B','EUR',999);
insert into public.transactions(user_id,wallet_id,period_id,type,amount,currency,category,date_start,date_end,budget_date_start,budget_date_end) values
 ('a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000005','a0020000-0000-4000-8000-000000000003','expense',10,'EUR','Divers','2026-01-02','2026-01-02','2026-01-02','2026-01-02'),
 ('a0020000-0000-4000-8000-000000000002','a0020000-0000-4000-8000-000000000006','a0020000-0000-4000-8000-000000000004','expense',99,'EUR','Divers','2026-01-02','2026-01-02','2026-01-02','2026-01-02');
insert into mcp_private.oauth_grants(user_id,client_id,resource,redirect_uri,challenge,code_hash,code_used,access_hash,access_expires_at)
 values ('a0020000-0000-4000-8000-000000000001','test','https://budget.example/mcp','https://chat.example/callback',repeat('a',43),repeat('b',43),true,repeat('c',43),clock_timestamp()+interval '10 minutes');
do $$ begin
  if has_function_privilege('authenticated','public.mcp_read_finance_v1(text,text,text,jsonb,integer,integer)','execute') or
    has_function_privilege('anon','public.mcp_read_finance_v1(text,text,text,jsonb,integer,integer)','execute') then raise exception 'Public read RPC exposed'; end if;
  if has_table_privilege('tb_mcp_reader','public.wallets','UPDATE') or has_table_privilege('tb_mcp_reader','public.transactions','INSERT') then raise exception 'Reader can write'; end if;
  if (select rolbypassrls from pg_roles where rolname='tb_mcp_reader') then raise exception 'Reader bypasses RLS'; end if;
end $$;
set local role service_role;
do $$ declare r jsonb; t text; denied boolean; begin
  r := public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','wallets','{}',0,500);
  if jsonb_array_length(r)<>1 or r->0->>'name'<>'Synthetic A' then raise exception 'Wallet isolation failed'; end if;
  r := public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','transactions','{}',0,500);
  if jsonb_array_length(r)<>1 or (r->0->>'amount')::numeric<>10 then raise exception 'Transaction isolation failed'; end if;
  if jsonb_array_length(public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','wallets',jsonb_build_object('id','a0020000-0000-4000-8000-000000000006'),0,500))<>0 then raise exception 'Other wallet visible'; end if;
  foreach t in array array['periods','budget_segments','travels','trip_groups'] loop
    perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp',t,'{}',0,500);
  end loop;
  denied := false;
  begin perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','profiles','{}',0,500);
  exception when others then denied := true; end;
  if not denied then raise exception 'Nonfinancial table exposed'; end if;
  denied := false;
  begin perform public.mcp_read_finance_v1(repeat('c',43),'https://evil.example','wallets','{}',0,500);
  exception when invalid_authorization_specification then denied := true; end;
  if not denied then raise exception 'Wrong resource allowed'; end if;
  update mcp_private.oauth_grants set revoked_at=clock_timestamp() where access_hash=repeat('c',43);
  denied := false;
  begin perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','wallets','{}',0,500);
  exception when invalid_authorization_specification then denied := true; end;
  if not denied then raise exception 'Revoked token allowed'; end if;
  if not public.mcp_reserve_request_v1('test-quota',1) or public.mcp_reserve_request_v1('test-quota',1) then raise exception 'Quota failed'; end if;
end $$;
reset role;
select 'Scoped SQL reads, RLS, revocation and quota assertions passed' as result;
rollback;
