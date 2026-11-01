-- Extension is opt-in. Existing MCP grants keep their initial access until the
-- owner saves the extended sharing preferences in the authenticated web page.
create table mcp_private.sharing_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 finance_enabled boolean not null default false,
 accounting_settings jsonb not null default '{}'::jsonb,
 settings_synced_at timestamptz,
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(accounting_settings)='object' and octet_length(accounting_settings::text)<=12000)
);
create table mcp_private.shared_documents (
 user_id uuid not null references auth.users(id) on delete cascade,
 document_id uuid not null references public.documents(id) on delete cascade,
 document_updated_at timestamptz not null,
 storage_path text not null,
 primary key(user_id,document_id)
);
alter table mcp_private.sharing_preferences enable row level security;
alter table mcp_private.shared_documents enable row level security;
revoke all on mcp_private.sharing_preferences,mcp_private.shared_documents from public,anon,authenticated;
grant select,insert,update,delete on mcp_private.sharing_preferences,mcp_private.shared_documents to service_role;
grant select on mcp_private.sharing_preferences,mcp_private.shared_documents to tb_mcp_reader;
create policy mcp_preferences_read on mcp_private.sharing_preferences for select to tb_mcp_reader using(user_id=(select auth.uid()));
create policy mcp_document_choices_read on mcp_private.shared_documents for select to tb_mcp_reader using(user_id=(select auth.uid()));

-- Explicit SELECT column grants and restrictive ownership remain the boundary.
grant select(id,user_id,name) on public.categories to tb_mcp_reader;
grant select(id,user_id,travel_id,name,asset_type,purchase_value,residual_value,currency,purchase_date,depreciation_months,status,include_in_budget,budget_method,monthly_budget_override,budget_start_date,budget_end_date,budget_day,budget_category,budget_subcategory) on public.assets to tb_mcp_reader;
grant select(id,user_id,asset_id,display_name,ownership_percent) on public.asset_owners to tb_mcp_reader;
grant select(id,user_id,asset_id,transaction_id,relation_type,exclude_from_budget) on public.asset_transaction_links to tb_mcp_reader;
grant select(id,user_id,trip_id,name,is_me,auth_user_id) on public.trip_members to tb_mcp_reader;
grant select(id,user_id,trip_id,date,label,amount,currency,paid_by_member_id,category,subcategory,budget_date_start,budget_date_end,kind,income_source,income_due_back) on public.trip_expenses to tb_mcp_reader;
grant select(id,user_id,trip_id,expense_id,member_id,share_amount) on public.trip_expense_shares to tb_mcp_reader;
grant select(id,trip_id,currency,amount,from_member_id,to_member_id,created_at,cancelled_at) on public.trip_settlement_events to tb_mcp_reader;
grant select(id,user_id,name,original_filename,mime_type,size_bytes,updated_at,storage_path,storage_bucket) on public.documents to tb_mcp_reader;
do $$ declare t text; guard text; begin
 foreach t in array array['categories','assets','asset_owners','asset_transaction_links','trip_members','trip_expenses','trip_expense_shares','trip_settlement_events','documents'] loop
  guard := 'user_id=(select auth.uid())';
  if t in ('trip_members','trip_expenses','trip_expense_shares','trip_settlement_events') then
   guard := 'trip_id in (select id from public.trip_groups where user_id=(select auth.uid()))';
  elsif t='asset_owners' then
   guard := 'asset_id in (select id from public.assets where user_id=(select auth.uid()))';
  elsif t='documents' then
   guard := 'user_id=(select auth.uid()) and exists(select 1 from mcp_private.shared_documents s where s.user_id=(select auth.uid()) and s.document_id=documents.id and s.document_updated_at=documents.updated_at and s.storage_path=documents.storage_path)';
  end if;
  execute format('create policy mcp_extended_read on public.%I for select to tb_mcp_reader using (%s)',t,guard);
  execute format('create policy mcp_extended_guard on public.%I as restrictive for select to tb_mcp_reader using (%s)',t,guard);
 end loop;
end $$;

insert into mcp_private.read_tables(name,columns_csv) values
 ('categories','id,user_id,name'),
 ('assets','id,user_id,travel_id,name,asset_type,purchase_value,residual_value,currency,purchase_date,depreciation_months,status,include_in_budget,budget_method,monthly_budget_override,budget_start_date,budget_end_date,budget_day,budget_category,budget_subcategory'),
 ('asset_owners','id,$1 as user_id,asset_id,display_name,ownership_percent'),
 ('asset_transaction_links','id,user_id,asset_id,transaction_id,relation_type,exclude_from_budget'),
 ('trip_members','id,$1 as user_id,trip_id,name,(case when auth_user_id is not null then auth_user_id=$1 else coalesce(is_me,false) end) as is_me'),
 ('trip_expenses','id,$1 as user_id,trip_id,date,label,amount,currency,paid_by_member_id,category,subcategory,budget_date_start,budget_date_end,kind,income_source,income_due_back'),
 ('trip_expense_shares','id,$1 as user_id,trip_id,expense_id,member_id,share_amount'),
 ('trip_settlement_events','id,$1 as user_id,trip_id,currency,amount,from_member_id,to_member_id,created_at,cancelled_at'),
 ('documents','id,user_id,name,original_filename,mime_type,size_bytes,updated_at');

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
 if p_table not in ('wallets','transactions','periods','budget_segments','travels','trip_groups','documents') and not exists(select 1 from mcp_private.sharing_preferences where user_id=owner_id and finance_enabled) then raise exception 'Extended sharing disabled' using errcode='42501'; end if;
 if p_table in ('trip_members','trip_expenses','trip_expense_shares','trip_settlement_events') then predicates:='trip_id in (select id from public.trip_groups where user_id=$1)';
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

create function public.mcp_sharing_v1(p_user_id uuid,p_update jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare doc_id uuid; settings jsonb; begin
 if p_update is not null then
  if jsonb_typeof(p_update)<>'object' or exists(select 1 from jsonb_object_keys(p_update) k where k not in ('finance_enabled','document_ids','accounting_settings'))
   or jsonb_typeof(p_update->'finance_enabled') is distinct from 'boolean' or jsonb_typeof(p_update->'document_ids') is distinct from 'array' or jsonb_array_length(p_update->'document_ids')>100 then raise exception 'Invalid preferences'; end if;
  settings:=p_update->'accounting_settings';
  if settings is not null and (jsonb_typeof(settings)<>'object' or octet_length(settings::text)>12000) then raise exception 'Invalid accounting settings'; end if;
  if settings is not null and exists(select 1 from jsonb_object_keys(settings) k where not exists(select 1 from public.travels where id::text=k and user_id=p_user_id)) then raise exception 'Settings ownership denied'; end if;
  insert into mcp_private.sharing_preferences(user_id,finance_enabled,accounting_settings,settings_synced_at) values(p_user_id,(p_update->>'finance_enabled')::boolean,coalesce(settings,'{}'),case when settings is not null then now() end)
   on conflict(user_id) do update set finance_enabled=excluded.finance_enabled,accounting_settings=coalesce(settings,mcp_private.sharing_preferences.accounting_settings),settings_synced_at=case when settings is not null then now() else mcp_private.sharing_preferences.settings_synced_at end,updated_at=now();
  delete from mcp_private.shared_documents where user_id=p_user_id;
  for doc_id in select distinct value::uuid from jsonb_array_elements_text(p_update->'document_ids') loop
   insert into mcp_private.shared_documents select p_user_id,id,updated_at,storage_path from public.documents where id=doc_id and user_id=p_user_id;
   if not found then raise exception 'Document ownership denied'; end if;
  end loop;
 end if;
 return jsonb_build_object('finance_enabled',coalesce((select finance_enabled from mcp_private.sharing_preferences where user_id=p_user_id),false),'settings_synced_at',(select settings_synced_at from mcp_private.sharing_preferences where user_id=p_user_id),
 'document_ids',coalesce((select jsonb_agg(s.document_id) from mcp_private.shared_documents s join public.documents d on d.id=s.document_id and d.user_id=s.user_id and d.updated_at=s.document_updated_at and d.storage_path=s.storage_path where s.user_id=p_user_id),'[]'),
 'documents',coalesce((select jsonb_agg(rows) from (select id,name,original_filename,mime_type,size_bytes from public.documents where user_id=p_user_id order by created_at desc,id limit 500) rows),'[]'),
 'documents_truncated',(select count(*)>500 from public.documents where user_id=p_user_id));
end $$;
revoke all on function public.mcp_sharing_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_sharing_v1(uuid,jsonb) to service_role;

create function public.mcp_extension_context_v1(p_hash text,p_resource text)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('finance_enabled',coalesce(p.finance_enabled,false),'accounting_settings',coalesce(p.accounting_settings,'{}'),'settings_synced_at',p.settings_synced_at)
 from mcp_private.oauth_grants g left join mcp_private.sharing_preferences p on p.user_id=g.user_id
 where g.access_hash=p_hash and g.resource=p_resource and g.scope='finance:read' and g.code_used and g.revoked_at is null and g.access_expires_at>clock_timestamp() and g.expires_at>clock_timestamp();
$$;
revoke all on function public.mcp_extension_context_v1(text,text) from public,anon,authenticated;
grant execute on function public.mcp_extension_context_v1(text,text) to service_role;

-- Storage location is only returned to the trusted host after rechecking both
-- token and the exact document version explicitly selected by its owner.
create function public.mcp_document_location_v1(p_hash text,p_resource text,p_document_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('id',d.id,'user_id',d.user_id,'name',d.name,'mime_type',d.mime_type,'size_bytes',d.size_bytes,'storage_bucket',d.storage_bucket,'storage_path',d.storage_path)
 from mcp_private.oauth_grants g join mcp_private.shared_documents s on s.user_id=g.user_id
 join public.documents d on d.id=s.document_id and d.user_id=g.user_id and d.updated_at=s.document_updated_at and d.storage_path=s.storage_path
 where d.id=p_document_id and g.access_hash=p_hash and g.resource=p_resource and g.scope='finance:read' and g.code_used and g.revoked_at is null and g.access_expires_at>clock_timestamp() and g.expires_at>clock_timestamp();
$$;
revoke all on function public.mcp_document_location_v1(text,text,uuid) from public,anon,authenticated;
grant execute on function public.mcp_document_location_v1(text,text,uuid) to service_role;
