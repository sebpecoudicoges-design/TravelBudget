-- Separate explicit consent; existing grants gain no new access automatically.
alter table mcp_private.sharing_preferences add column all_documents boolean not null default false, add column sport_enabled boolean not null default false, add column nutrition_enabled boolean not null default false;
grant select(id,user_id,travel_id,activity_type,started_at,ended_at,duration_seconds,mood_before,mood_after,energy,fatigue,pain,body_weight_kg,notes,estimated_kcal) on public.sport_sessions to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('sport_sessions','id,user_id,travel_id,activity_type,started_at,ended_at,duration_seconds,mood_before,mood_after,energy,fatigue,pain,body_weight_kg,notes,estimated_kcal');
create policy mcp_health_read on public.sport_sessions for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.sport_sessions as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and sport_enabled));
grant select(id,user_id,session_id,activity_key,exercise_key,exercise_name,equipment,mode,target_reps,target_seconds,distance_m,planned_sets,rest_seconds,sort_order,notes) on public.sport_session_items to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('sport_session_items','id,user_id,session_id,activity_key,exercise_key,exercise_name,equipment,mode,target_reps,target_seconds,distance_m,planned_sets,rest_seconds,sort_order,notes');
create policy mcp_health_read on public.sport_session_items for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.sport_session_items as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and sport_enabled));
grant select(id,user_id,item_id,set_index,reps,duration_seconds,weight_kg,distance_m,completed_at,perceived_effort,notes) on public.sport_sets to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('sport_sets','id,user_id,item_id,set_index,reps,duration_seconds,weight_kg,distance_m,completed_at,perceived_effort,notes');
create policy mcp_health_read on public.sport_sets for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.sport_sets as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and sport_enabled));
grant select(id,user_id,key,name,goal,cycle,start_date,is_active,notes) on public.sport_programs to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('sport_programs','id,user_id,key,name,goal,cycle,start_date,is_active,notes');
create policy mcp_health_read on public.sport_programs for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.sport_programs as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and sport_enabled));
grant select(id,program_id,session_key,name,week_label,day_of_week,sort_order,notes) on public.sport_program_sessions to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('sport_program_sessions','id,$1 as user_id,program_id,session_key,name,week_label,day_of_week,sort_order,notes');
create policy mcp_health_read on public.sport_program_sessions for select to tb_mcp_reader using (program_id in (select id from public.sport_programs where user_id=(select auth.uid())));
create policy mcp_health_guard on public.sport_program_sessions as restrictive for select to tb_mcp_reader using (program_id in (select id from public.sport_programs where user_id=(select auth.uid())) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and sport_enabled));
grant select(id,session_id,exercise_key,exercise_name,mode,target_reps,target_seconds,planned_sets,rest_seconds,default_weight_kg,distance_m,sort_order,notes) on public.sport_program_exercises to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('sport_program_exercises','id,$1 as user_id,session_id,exercise_key,exercise_name,mode,target_reps,target_seconds,planned_sets,rest_seconds,default_weight_kg,distance_m,sort_order,notes');
create policy mcp_health_read on public.sport_program_exercises for select to tb_mcp_reader using (session_id in (select id from public.sport_program_sessions where program_id in (select id from public.sport_programs where user_id=(select auth.uid()))));
create policy mcp_health_guard on public.sport_program_exercises as restrictive for select to tb_mcp_reader using (session_id in (select id from public.sport_program_sessions where program_id in (select id from public.sport_programs where user_id=(select auth.uid()))) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and sport_enabled));
grant select(id,user_id,exercise_id,latest_weight_kg,latest_reps,latest_e1rm_kg,best_all_time_e1rm_kg,training_max_kg,recommended_weight_kg,recommendation_reason,calculated_at) on public.sport_exercise_metrics to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('sport_exercise_metrics','id,user_id,exercise_id,latest_weight_kg,latest_reps,latest_e1rm_kg,best_all_time_e1rm_kg,training_max_kg,recommended_weight_kg,recommendation_reason,calculated_at');
create policy mcp_health_read on public.sport_exercise_metrics for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.sport_exercise_metrics as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and sport_enabled));
grant select(id,user_id,travel_id,meal_date,meal_type,label,notes,water_ml,consumed_time) on public.nutrition_meals to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('nutrition_meals','id,user_id,travel_id,meal_date,meal_type,label,notes,water_ml,consumed_time');
create policy mcp_health_read on public.nutrition_meals for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.nutrition_meals as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and nutrition_enabled));
grant select(id,user_id,meal_id,food_key,label,grams,kcal,protein_g,carbs_g,fat_g,fiber_g,sort_order) on public.nutrition_meal_items to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('nutrition_meal_items','id,user_id,meal_id,food_key,label,grams,kcal,protein_g,carbs_g,fat_g,fiber_g,sort_order');
create policy mcp_health_read on public.nutrition_meal_items for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.nutrition_meal_items as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and nutrition_enabled));
grant select(id,user_id,sleep_date,hours,quality,notes) on public.nutrition_sleep to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('nutrition_sleep','id,user_id,sleep_date,hours,quality,notes');
create policy mcp_health_read on public.nutrition_sleep for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.nutrition_sleep as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and nutrition_enabled));
grant select(id,user_id,name,description,default_servings,is_archived) on public.nutrition_recipes to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('nutrition_recipes','id,user_id,name,description,default_servings,is_archived');
create policy mcp_health_read on public.nutrition_recipes for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.nutrition_recipes as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and nutrition_enabled));
grant select(id,user_id,recipe_id,food_key,label,quantity,unit,quantity_grams,initial_state,cooking_method_code,sort_order,notes) on public.nutrition_recipe_ingredients to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('nutrition_recipe_ingredients','id,user_id,recipe_id,food_key,label,quantity,unit,quantity_grams,initial_state,cooking_method_code,sort_order,notes');
create policy mcp_health_read on public.nutrition_recipe_ingredients for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.nutrition_recipe_ingredients as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and nutrition_enabled));
grant select(id,user_id,recipe_id,cooked_at,name,final_weight_g,final_weight_source,servings,precision_level,total_kcal,total_protein_g,total_carbs_g,total_fat_g,total_fiber_g,notes) on public.nutrition_recipe_batches to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('nutrition_recipe_batches','id,user_id,recipe_id,cooked_at,name,final_weight_g,final_weight_source,servings,precision_level,total_kcal,total_protein_g,total_carbs_g,total_fat_g,total_fiber_g,notes');
create policy mcp_health_read on public.nutrition_recipe_batches for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.nutrition_recipe_batches as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and nutrition_enabled));
grant select(id,user_id,batch_id,meal_id,consumed_at,consumed_weight_g,nutrition_snapshot) on public.nutrition_recipe_batch_consumptions to tb_mcp_reader;
insert into mcp_private.read_tables(name,columns_csv) values('nutrition_recipe_batch_consumptions','id,user_id,batch_id,meal_id,consumed_at,consumed_weight_g,nutrition_snapshot');
create policy mcp_health_read on public.nutrition_recipe_batch_consumptions for select to tb_mcp_reader using (user_id=(select auth.uid()));
create policy mcp_health_guard on public.nutrition_recipe_batch_consumptions as restrictive for select to tb_mcp_reader using (user_id=(select auth.uid()) and exists(select 1 from mcp_private.sharing_preferences where user_id=(select auth.uid()) and nutrition_enabled));
alter policy mcp_extended_read on public.documents using (user_id=(select auth.uid()) and (exists(select 1 from mcp_private.sharing_preferences p where p.user_id=(select auth.uid()) and p.all_documents) or exists(select 1 from mcp_private.shared_documents s where s.user_id=(select auth.uid()) and s.document_id=documents.id and s.document_updated_at=documents.updated_at and s.storage_path=documents.storage_path)));
alter policy mcp_extended_guard on public.documents using (user_id=(select auth.uid()) and (exists(select 1 from mcp_private.sharing_preferences p where p.user_id=(select auth.uid()) and p.all_documents) or exists(select 1 from mcp_private.shared_documents s where s.user_id=(select auth.uid()) and s.document_id=documents.id and s.document_updated_at=documents.updated_at and s.storage_path=documents.storage_path)));
grant tb_mcp_reader to postgres;
grant create on schema mcp_private to tb_mcp_reader;
set local role tb_mcp_reader;
create or replace function mcp_private.read_finance_v1(p_hash text,p_resource text,p_table text,p_filters jsonb,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; cols text; predicates text:='user_id = $1'; result jsonb;
 previous_claims text:=current_setting('request.jwt.claims',true);
begin
 if p_offset is null or p_offset<0 or p_offset>1000000 or p_limit is null or p_limit<1 or p_limit>500 or p_filters is null or jsonb_typeof(p_filters)<>'object' then raise exception 'Invalid read request'; end if;
 select columns_csv into cols from mcp_private.read_tables where name=p_table;
 if cols is null then raise exception 'Read table denied'; end if;
 if exists(select 1 from jsonb_object_keys(p_filters) k where not(k='id' or (k='period_id' and p_table='budget_segments') or (k in ('wallet_id','date_from','date_to') and p_table='transactions') or (k='trip_id' and p_table in ('trip_members','trip_expenses','trip_expense_shares','trip_settlement_events')))) then raise exception 'Read filter denied'; end if;
 select user_id into owner_id from mcp_private.oauth_grants where access_hash=p_hash and resource=p_resource and scope='finance:read' and code_used and revoked_at is null and access_expires_at>clock_timestamp() and expires_at>clock_timestamp();
 if owner_id is null then raise exception 'Invalid MCP access' using errcode='28000'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','tb_mcp_reader')::text,true);
 if p_table like 'sport_%' or p_table like 'nutrition_%' then
  if not exists(select 1 from mcp_private.sharing_preferences where user_id=owner_id and case when p_table like 'sport_%' then sport_enabled else nutrition_enabled end) then raise exception 'Health sharing disabled' using errcode='42501';end if;
 elsif p_table not in ('wallets','transactions','periods','budget_segments','travels','trip_groups','documents') and not exists(select 1 from mcp_private.sharing_preferences where user_id=owner_id and finance_enabled) then raise exception 'Extended sharing disabled' using errcode='42501'; end if;
 if p_table='sport_program_sessions' then predicates:='program_id in (select id from public.sport_programs where user_id=$1)';
 elsif p_table='sport_program_exercises' then predicates:='session_id in (select id from public.sport_program_sessions where program_id in (select id from public.sport_programs where user_id=$1))';
 elsif p_table in ('trip_members','trip_expenses','trip_expense_shares','trip_settlement_events') then predicates:='trip_id in (select id from public.trip_groups where user_id=$1)';
 elsif p_table='asset_owners' then predicates:='asset_id in (select id from public.assets where user_id=$1)'; end if;
 if p_filters?'id' then predicates:=predicates||' and id=($2->>''id'')::uuid'; end if;
 if p_filters?'period_id' then predicates:=predicates||' and period_id=($2->>''period_id'')::uuid'; end if;
 if p_filters?'trip_id' then predicates:=predicates||' and trip_id=($2->>''trip_id'')::uuid'; end if;
 if p_filters?'wallet_id' then predicates:=predicates||' and wallet_id=($2->>''wallet_id'')::uuid'; end if;
 if p_filters?'date_from' then predicates:=predicates||' and date_start>=($2->>''date_from'')::date'; end if;
 if p_filters?'date_to' then predicates:=predicates||' and date_start<=($2->>''date_to'')::date'; end if;
 execute format('select coalesce(jsonb_agg(row_to_json(rows)),''[]''::jsonb) from (select %s from public.%I where %s order by id offset $3 limit $4) rows',cols,p_table,predicates) into result using owner_id,p_filters,p_offset,p_limit;
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true); return result;
exception when others then perform set_config('request.jwt.claims',coalesce(previous_claims,''),true); raise;
end $$;
-- CREATE OR REPLACE preserves the restricted owner and ACL of this function.
reset role;
revoke create on schema mcp_private from tb_mcp_reader;
revoke tb_mcp_reader from postgres;

create or replace function public.mcp_sharing_v1(p_user_id uuid,p_update jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare doc_id uuid; settings jsonb; begin
 if p_update is not null then
  if jsonb_typeof(p_update)<>'object' or exists(select 1 from jsonb_object_keys(p_update) k where k not in ('finance_enabled','document_ids','accounting_settings','all_documents','sport_enabled','nutrition_enabled'))
   or jsonb_typeof(p_update->'finance_enabled') is distinct from 'boolean' or jsonb_typeof(p_update->'document_ids') is distinct from 'array' or jsonb_array_length(p_update->'document_ids')>100 then raise exception 'Invalid preferences'; end if;
  if exists(select 1 from jsonb_each(p_update) e where e.key in ('all_documents','sport_enabled','nutrition_enabled') and jsonb_typeof(e.value)<>'boolean') then raise exception 'Invalid consent';end if;
  settings:=p_update->'accounting_settings';
  if settings is not null and (jsonb_typeof(settings)<>'object' or octet_length(settings::text)>12000) then raise exception 'Invalid accounting settings'; end if;
  if settings is not null and exists(select 1 from jsonb_object_keys(settings) k where not exists(select 1 from public.travels where id::text=k and user_id=p_user_id)) then raise exception 'Settings ownership denied'; end if;
  insert into mcp_private.sharing_preferences(user_id,finance_enabled,accounting_settings,settings_synced_at) values(p_user_id,(p_update->>'finance_enabled')::boolean,coalesce(settings,'{}'),case when settings is not null then now() end)
   on conflict(user_id) do update set finance_enabled=excluded.finance_enabled,accounting_settings=coalesce(settings,mcp_private.sharing_preferences.accounting_settings),settings_synced_at=case when settings is not null then now() else mcp_private.sharing_preferences.settings_synced_at end,updated_at=now();
  update mcp_private.sharing_preferences set all_documents=coalesce((p_update->>'all_documents')::boolean,false),sport_enabled=coalesce((p_update->>'sport_enabled')::boolean,false),nutrition_enabled=coalesce((p_update->>'nutrition_enabled')::boolean,false) where user_id=p_user_id;
  delete from mcp_private.shared_documents where user_id=p_user_id;
  for doc_id in select distinct value::uuid from jsonb_array_elements_text(p_update->'document_ids') loop
   insert into mcp_private.shared_documents select p_user_id,id,updated_at,storage_path from public.documents where id=doc_id and user_id=p_user_id;
   if not found then raise exception 'Document ownership denied'; end if;
  end loop;
 end if;
 return jsonb_build_object('all_documents',coalesce((select all_documents from mcp_private.sharing_preferences where user_id=p_user_id),false),'sport_enabled',coalesce((select sport_enabled from mcp_private.sharing_preferences where user_id=p_user_id),false),'nutrition_enabled',coalesce((select nutrition_enabled from mcp_private.sharing_preferences where user_id=p_user_id),false),'finance_enabled',coalesce((select finance_enabled from mcp_private.sharing_preferences where user_id=p_user_id),false),'settings_synced_at',(select settings_synced_at from mcp_private.sharing_preferences where user_id=p_user_id),
 'document_ids',coalesce((select jsonb_agg(s.document_id) from mcp_private.shared_documents s join public.documents d on d.id=s.document_id and d.user_id=s.user_id and d.updated_at=s.document_updated_at and d.storage_path=s.storage_path where s.user_id=p_user_id),'[]'),
 'documents',coalesce((select jsonb_agg(rows) from (select id,name,original_filename,mime_type,size_bytes from public.documents where user_id=p_user_id order by created_at desc,id limit 500) rows),'[]'),
 'documents_truncated',(select count(*)>500 from public.documents where user_id=p_user_id));
end $$;
revoke all on function public.mcp_sharing_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_sharing_v1(uuid,jsonb) to service_role;

create or replace function public.mcp_extension_context_v1(p_hash text,p_resource text)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('all_documents',coalesce(p.all_documents,false),'sport_enabled',coalesce(p.sport_enabled,false),'nutrition_enabled',coalesce(p.nutrition_enabled,false),'finance_enabled',coalesce(p.finance_enabled,false),'accounting_settings',coalesce(p.accounting_settings,'{}'),'settings_synced_at',p.settings_synced_at)
 from mcp_private.oauth_grants g left join mcp_private.sharing_preferences p on p.user_id=g.user_id
 where g.access_hash=p_hash and g.resource=p_resource and g.scope='finance:read' and g.code_used and g.revoked_at is null and g.access_expires_at>clock_timestamp() and g.expires_at>clock_timestamp();
$$;
revoke all on function public.mcp_extension_context_v1(text,text) from public,anon,authenticated;
grant execute on function public.mcp_extension_context_v1(text,text) to service_role;

-- Storage location is only returned to the trusted host after rechecking both
-- token and the exact document version explicitly selected by its owner.
create or replace function public.mcp_document_location_v1(p_hash text,p_resource text,p_document_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('id',d.id,'user_id',d.user_id,'name',d.name,'mime_type',d.mime_type,'size_bytes',d.size_bytes,'storage_bucket',d.storage_bucket,'storage_path',d.storage_path)
 from mcp_private.oauth_grants g join public.documents d on d.user_id=g.user_id
 left join mcp_private.sharing_preferences p on p.user_id=g.user_id
 left join mcp_private.shared_documents s on s.user_id=g.user_id and s.document_id=d.id and d.updated_at=s.document_updated_at and d.storage_path=s.storage_path
 where (coalesce(p.all_documents,false) or s.document_id is not null) and d.id=p_document_id and g.access_hash=p_hash and g.resource=p_resource and g.scope='finance:read' and g.code_used and g.revoked_at is null and g.access_expires_at>clock_timestamp() and g.expires_at>clock_timestamp();
$$;
revoke all on function public.mcp_document_location_v1(text,text,uuid) from public,anon,authenticated;
grant execute on function public.mcp_document_location_v1(text,text,uuid) to service_role;
