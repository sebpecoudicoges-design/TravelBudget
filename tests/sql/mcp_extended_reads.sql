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
-- All fixtures are rolled back; no real financial or storage object is read.
insert into public.assets(id,user_id,name,asset_type,purchase_value,currency,purchase_date,depreciation_months) values
 ('a0020000-0000-4000-8000-000000000010','a0020000-0000-4000-8000-000000000001','Synthetic asset','equipment',1200,'EUR','2026-01-01',12),
 ('a0020000-0000-4000-8000-000000000011','a0020000-0000-4000-8000-000000000002','Other asset','equipment',9999,'EUR','2026-01-01',12);
select set_config('request.jwt.claims','{"sub":"a0020000-0000-4000-8000-000000000001"}',true);
insert into public.trip_groups(id,user_id,name,base_currency) values
 ('a0020000-0000-4000-8000-000000000020','a0020000-0000-4000-8000-000000000001','Synthetic group','EUR');
select set_config('request.jwt.claims','{"sub":"a0020000-0000-4000-8000-000000000002"}',true);
insert into public.trip_groups(id,user_id,name,base_currency) values
 ('a0020000-0000-4000-8000-000000000021','a0020000-0000-4000-8000-000000000002','Other group','EUR');
select set_config('request.jwt.claims','{"sub":"a0020000-0000-4000-8000-000000000001"}',true);
insert into public.trip_members(id,user_id,trip_id,name,is_me) values
 ('a0020000-0000-4000-8000-000000000030','a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000020','Moi',true),
 ('a0020000-0000-4000-8000-000000000031','a0020000-0000-4000-8000-000000000002','a0020000-0000-4000-8000-000000000021','Other',true);
insert into public.trip_expenses(id,user_id,trip_id,date,label,amount,currency,paid_by_member_id) values
 ('a0020000-0000-4000-8000-000000000040','a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000020','2026-01-01','Synthetic expense',100,'EUR','a0020000-0000-4000-8000-000000000030');
insert into public.trip_expense_shares(user_id,trip_id,expense_id,member_id,share_amount) values
 ('a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000020','a0020000-0000-4000-8000-000000000040','a0020000-0000-4000-8000-000000000030',100);
insert into public.documents(id,user_id,name,original_filename,storage_bucket,storage_path,mime_type,size_bytes) values
 ('a0020000-0000-4000-8000-000000000050','a0020000-0000-4000-8000-000000000001','Synthetic selected','selected.txt','personal-documents','a0020000-0000-4000-8000-000000000001/a0020000-0000-4000-8000-000000000050/selected.txt','text/plain',5),
 ('a0020000-0000-4000-8000-000000000051','a0020000-0000-4000-8000-000000000002','Other document','other.txt','personal-documents','a0020000-0000-4000-8000-000000000002/a0020000-0000-4000-8000-000000000051/other.txt','text/plain',5);
set local role authenticated;
do $$ begin
 if not public.is_trip_participant('a0020000-0000-4000-8000-000000000020') or public.is_trip_participant('a0020000-0000-4000-8000-000000000021') then raise exception 'Regular app participant behavior changed';end if;
 if public.trip_role('a0020000-0000-4000-8000-000000000020')<>'owner' or public.trip_role('a0020000-0000-4000-8000-000000000021') is not null then raise exception 'Regular app role behavior changed';end if;
end $$;
reset role;
set local role service_role;
do $$ declare r jsonb; denied boolean; t text; begin
 denied:=false;begin perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','assets','{}',0,500);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Extended access enabled without opt-in';end if;
 if jsonb_array_length(public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','documents','{}',0,500))<>0 then raise exception 'Unselected document exposed';end if;
 perform public.mcp_sharing_v1('a0020000-0000-4000-8000-000000000001','{"finance_enabled":true,"document_ids":["a0020000-0000-4000-8000-000000000050"]}');
 r:=public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','assets','{}',0,500);
 if jsonb_array_length(r)<>1 or r->0->>'name'<>'Synthetic asset' then raise exception 'Asset isolation failed';end if;
 r:=public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','trip_members','{}',0,500);
 if jsonb_array_length(r)<>1 or r->0->>'user_id'<>'a0020000-0000-4000-8000-000000000001' or (r->0)?'auth_user_id' or (r->0)?'email' then raise exception 'Trip member isolation failed';end if;
 foreach t in array array['trip_expenses','trip_expense_shares'] loop
  r:=public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp',t,'{"trip_id":"a0020000-0000-4000-8000-000000000020"}',0,500);
  if jsonb_array_length(r)<>1 then raise exception 'Trip rows missing: %',t;end if;
 end loop;
 foreach t in array array['asset_owners','asset_transaction_links','categories','trip_settlement_events'] loop
  perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp',t,'{}',0,500);
 end loop;
 r:=public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','documents','{}',0,500);
 if jsonb_array_length(r)<>1 or (r->0)?'storage_path' then raise exception 'Selected document catalog failed';end if;
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp','a0020000-0000-4000-8000-000000000051') is not null then raise exception 'Other document location exposed';end if;
 denied:=false;begin perform public.mcp_sharing_v1('a0020000-0000-4000-8000-000000000001','{"finance_enabled":true,"document_ids":["a0020000-0000-4000-8000-000000000051"]}');exception when others then denied:=true;end;
 if not denied then raise exception 'Other document selection allowed';end if;
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp','a0020000-0000-4000-8000-000000000050') is null then raise exception 'Failed selection lost previous choices';end if;
end $$;
reset role;
-- updated_at is maintained by a NOW() trigger (same instant in this transaction).
-- Changing the stored file version exercises the second half of the selection binding.
update public.documents set storage_path=storage_path||'.changed' where id='a0020000-0000-4000-8000-000000000050';
set local role service_role;
do $$ begin
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp','a0020000-0000-4000-8000-000000000050') is not null then raise exception 'Changed document still shared';end if;
 perform public.mcp_sharing_v1('a0020000-0000-4000-8000-000000000001','{"finance_enabled":false,"document_ids":[]}');
 if (public.mcp_extension_context_v1(repeat('c',43),'https://budget.example/mcp')->>'finance_enabled')::boolean then raise exception 'Disable ignored';end if;
 update mcp_private.oauth_grants set revoked_at=now() where access_hash=repeat('c',43);
 if public.mcp_extension_context_v1(repeat('c',43),'https://budget.example/mcp') is not null then raise exception 'Revoked token reads settings';end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','public.mcp_sharing_v1(uuid,jsonb)','execute') or has_function_privilege('anon','public.mcp_document_location_v1(text,text,uuid)','execute') then raise exception 'Private RPC publicly exposed';end if;
 if has_table_privilege('tb_mcp_reader','public.documents','UPDATE') or has_table_privilege('tb_mcp_reader','public.assets','INSERT') then raise exception 'Reader can write';end if;
 if (select pg_get_userbyid(proowner) from pg_proc where oid='mcp_private.read_finance_v1(text,text,text,jsonb,integer,integer)'::regprocedure)<>'tb_mcp_reader' then raise exception 'Wrong reader owner';end if;
end $$;
select 'Extended ownership, opt-in, selected document version, revoke and SELECT-only assertions passed' as result;
rollback;
