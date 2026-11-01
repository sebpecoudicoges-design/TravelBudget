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

-- Only synthetic rows, always rolled back.
insert into public.sport_sessions(id,user_id) values('a0020000-0000-4000-8000-000000000101','a0020000-0000-4000-8000-000000000001');
insert into public.sport_session_items(id,user_id,session_id,exercise_name) values('a0020000-0000-4000-8000-000000000111','a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000101','Synthetic');
insert into public.sport_sets(user_id,item_id,set_index,reps) values('a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000111',1,10);
insert into public.sport_programs(id,user_id,key,name) values('a0020000-0000-4000-8000-000000000121','a0020000-0000-4000-8000-000000000001','synthetic','Synthetic');
insert into public.sport_program_sessions(id,program_id,session_key,name,week_label,day_of_week) values('a0020000-0000-4000-8000-000000000131','a0020000-0000-4000-8000-000000000121','test','Synthetic','A',1);
insert into public.sport_program_exercises(session_id,exercise_name) values('a0020000-0000-4000-8000-000000000131','Synthetic');
insert into public.nutrition_meals(id,user_id) values('a0020000-0000-4000-8000-000000000141','a0020000-0000-4000-8000-000000000001');
insert into public.nutrition_meal_items(user_id,meal_id,label) values('a0020000-0000-4000-8000-000000000001','a0020000-0000-4000-8000-000000000141','Synthetic');
insert into public.documents(user_id,name,original_filename,storage_bucket,storage_path,mime_type,size_bytes) select 'a0020000-0000-4000-8000-000000000001','Synthetic '||i,'file.txt','personal-documents','a0020000-0000-4000-8000-000000000001/synthetic/'||i,'text/plain',5 from generate_series(1,105) i;
insert into public.sport_sessions(id,user_id) values('a0020000-0000-4000-8000-000000000102','a0020000-0000-4000-8000-000000000002');
insert into public.sport_session_items(id,user_id,session_id,exercise_name) values('a0020000-0000-4000-8000-000000000112','a0020000-0000-4000-8000-000000000002','a0020000-0000-4000-8000-000000000102','Synthetic');
insert into public.sport_sets(user_id,item_id,set_index,reps) values('a0020000-0000-4000-8000-000000000002','a0020000-0000-4000-8000-000000000112',1,10);
insert into public.sport_programs(id,user_id,key,name) values('a0020000-0000-4000-8000-000000000122','a0020000-0000-4000-8000-000000000002','synthetic','Synthetic');
insert into public.sport_program_sessions(id,program_id,session_key,name,week_label,day_of_week) values('a0020000-0000-4000-8000-000000000132','a0020000-0000-4000-8000-000000000122','test','Synthetic','A',1);
insert into public.sport_program_exercises(session_id,exercise_name) values('a0020000-0000-4000-8000-000000000132','Synthetic');
insert into public.nutrition_meals(id,user_id) values('a0020000-0000-4000-8000-000000000142','a0020000-0000-4000-8000-000000000002');
insert into public.nutrition_meal_items(user_id,meal_id,label) values('a0020000-0000-4000-8000-000000000002','a0020000-0000-4000-8000-000000000142','Synthetic');
insert into public.documents(user_id,name,original_filename,storage_bucket,storage_path,mime_type,size_bytes) select 'a0020000-0000-4000-8000-000000000002','Synthetic '||i,'file.txt','personal-documents','a0020000-0000-4000-8000-000000000002/synthetic/'||i,'text/plain',5 from generate_series(1,105) i;
set local role service_role;
do $$ declare r jsonb; t text; denied boolean; new_doc uuid; foreign_doc uuid; begin
 foreach t in array array['sport_sessions','nutrition_meals'] loop
 denied:=false;begin perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp',t,'{}',0,100);exception when others then denied:=true;end;
 if not denied then raise exception 'Missing consent allowed %',t;end if;end loop;
 perform public.mcp_sharing_v1('a0020000-0000-4000-8000-000000000001','{"finance_enabled":false,"document_ids":[],"sport_enabled":true,"nutrition_enabled":true,"all_documents":true}');
 foreach t in array array['sport_sessions','sport_session_items','sport_sets','sport_programs','sport_program_sessions','sport_program_exercises','nutrition_meals','nutrition_meal_items'] loop
 r:=public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp',t,'{}',0,100);
 if jsonb_array_length(r)<>1 or r->0->>'user_id'<>'a0020000-0000-4000-8000-000000000001' then raise exception 'Owner boundary failed %',t;end if;end loop;
 foreach t in array array['sport_sessions','sport_session_items','sport_sets','sport_programs','sport_program_sessions','sport_program_exercises','sport_exercise_metrics','nutrition_meals','nutrition_meal_items','nutrition_sleep','nutrition_recipes','nutrition_recipe_ingredients','nutrition_recipe_batches','nutrition_recipe_batch_consumptions'] loop
 perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp',t,'{}',0,100);
 if has_table_privilege('tb_mcp_reader','public.'||t,'INSERT,UPDATE,DELETE') then raise exception 'Reader can write %',t;end if;end loop;
 r:=public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','documents','{}',0,500);
 if jsonb_array_length(r)<>105 then raise exception 'All documents capped or foreign documents exposed';end if;
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp',(r->104->>'id')::uuid) is null then raise exception 'All document content refused';end if;
 insert into public.documents(user_id,name,storage_bucket,storage_path,mime_type,size_bytes) values('a0020000-0000-4000-8000-000000000001','Future','personal-documents','future.txt','text/plain',5) returning id into new_doc;
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp',new_doc) is null then raise exception 'Future document excluded';end if;
 update public.documents set storage_path='changed.txt' where id=new_doc;
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp',new_doc)->>'storage_path'<>'changed.txt' then raise exception 'Changed document excluded';end if;
 select id into foreign_doc from public.documents where user_id='a0020000-0000-4000-8000-000000000002' limit 1;
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp',foreign_doc) is not null then raise exception 'Foreign file location leaked';end if;
 perform public.mcp_sharing_v1('a0020000-0000-4000-8000-000000000001','{"finance_enabled":false,"document_ids":[],"sport_enabled":false,"nutrition_enabled":true,"all_documents":false}');
 r:=public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','documents','{}',0,500);
 if jsonb_array_length(r)<>0 then raise exception 'Document withdrawal failed';end if;
 if public.mcp_document_location_v1(repeat('c',43),'https://budget.example/mcp',new_doc) is not null then raise exception 'Document bytes still readable';end if;
 denied:=false;begin perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','sport_sessions','{}',0,100);exception when others then denied:=true;end;
 if not denied then raise exception 'Sport withdrawal failed';end if;
 perform public.mcp_read_finance_v1(repeat('c',43),'https://budget.example/mcp','nutrition_meals','{}',0,100);
end $$;reset role;
rollback;
select 'All document and health consent/isolation checks passed' as result;