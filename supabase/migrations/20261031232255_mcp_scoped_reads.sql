-- The privileged HTTP host can invoke only a closed read interface here.
-- Its implementation runs as a NOLOGIN/NOBYPASSRLS role with SELECT-only grants.
create role tb_mcp_reader nologin noinherit nobypassrls;
grant usage on schema public, mcp_private, auth to tb_mcp_reader;
grant execute on function auth.uid() to tb_mcp_reader;
-- Existing Trip RLS policies consult membership. Only these policy columns are
-- readable; participant data is not a selectable MCP table or response field.
grant select (trip_id,auth_user_id,role) on public.trip_participants to tb_mcp_reader;
create policy mcp_participant_guard on public.trip_participants as restrictive for select to tb_mcp_reader using (auth_user_id = (select auth.uid()));
grant select on mcp_private.oauth_grants to tb_mcp_reader;
create policy mcp_reader_grant_lookup on mcp_private.oauth_grants for select to tb_mcp_reader using (true);

-- One canonical allowlist for the SQL read boundary and column-level privileges.
create table mcp_private.read_tables (name text primary key, columns_csv text not null);
alter table mcp_private.read_tables enable row level security;
revoke all on mcp_private.read_tables from public, anon, authenticated;
grant select on mcp_private.read_tables to tb_mcp_reader;
create policy mcp_read_table_catalog on mcp_private.read_tables for select to tb_mcp_reader using (true);
insert into mcp_private.read_tables values
 ('wallets','id,user_id,name,currency,balance,balance_snapshot_at,period_id,travel_id,archived'),
 ('transactions','id,user_id,wallet_id,type,amount,currency,category,subcategory,label,date_start,date_end,budget_date_start,budget_date_end,paid_at,created_at,updated_at,pay_now,is_internal,affects_budget,out_of_budget,period_id,travel_id,trip_expense_id,trip_share_link_id'),
 ('periods','id,user_id,travel_id,start_date,end_date,base_currency,daily_budget_base,eur_base_rate'),
 ('budget_segments','id,user_id,period_id,start_date,end_date,base_currency,daily_budget_base,transport_night_budget,fx_mode,eur_base_rate_fixed,fx_rate_eur_to_base,sort_order'),
 ('travels','id,user_id,name,base_currency,start_date,end_date'),
 ('trip_groups','id,user_id,period_id,name,base_currency,closed_at');
do $$ declare r record; begin
  for r in select * from mcp_private.read_tables loop
    execute format('grant select (%s) on public.%I to tb_mcp_reader', r.columns_csv, r.name);
    execute format('create policy mcp_owned_read on public.%I for select to tb_mcp_reader using (user_id = (select auth.uid()))', r.name);
    -- Mandatory even if a pre-existing permissive PUBLIC policy allows shared rows.
    execute format('create policy mcp_owner_guard on public.%I as restrictive for select to tb_mcp_reader using (user_id = (select auth.uid()))', r.name);
  end loop;
end $$;

create function mcp_private.read_finance_v1(p_hash text, p_resource text, p_table text, p_filters jsonb, p_offset integer, p_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  cols text;
  predicates text := 'user_id = $1';
  result jsonb;
  previous_claims text := current_setting('request.jwt.claims', true);
begin
  if p_offset is null or p_offset < 0 or p_offset > 1000000 or p_limit is null or p_limit < 1 or p_limit > 500
    or p_filters is null or jsonb_typeof(p_filters) <> 'object' then raise exception 'Invalid read request'; end if;
  select columns_csv into cols from mcp_private.read_tables where name = p_table;
  if cols is null then raise exception 'Read table denied'; end if;
  if exists(select 1 from jsonb_object_keys(p_filters) key where
    not (key = 'id' or (key = 'period_id' and p_table = 'budget_segments') or
      (key in ('wallet_id','date_from','date_to') and p_table = 'transactions'))) then raise exception 'Read filter denied'; end if;
  select user_id into owner_id from mcp_private.oauth_grants
    where access_hash = p_hash and resource = p_resource and scope = 'finance:read' and code_used
      and revoked_at is null and access_expires_at > clock_timestamp() and expires_at > clock_timestamp();
  if owner_id is null then raise exception 'Invalid MCP access' using errcode = '28000'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',owner_id,'role','tb_mcp_reader')::text, true);
  if p_filters ? 'id' then predicates := predicates || ' and id = ($2->>''id'')::uuid'; end if;
  if p_filters ? 'period_id' then predicates := predicates || ' and period_id = ($2->>''period_id'')::uuid'; end if;
  if p_filters ? 'wallet_id' then predicates := predicates || ' and wallet_id = ($2->>''wallet_id'')::uuid'; end if;
  if p_filters ? 'date_from' then predicates := predicates || ' and date_start >= ($2->>''date_from'')::date'; end if;
  if p_filters ? 'date_to' then predicates := predicates || ' and date_start <= ($2->>''date_to'')::date'; end if;
  execute format('select coalesce(jsonb_agg(row_to_json(rows)), ''[]''::jsonb) from (select %s from public.%I where %s order by id offset $3 limit $4) rows', cols, p_table, predicates)
    into result using owner_id, p_filters, p_offset, p_limit;
  perform set_config('request.jwt.claims', coalesce(previous_claims,''), true);
  return result;
exception when others then
  perform set_config('request.jwt.claims', coalesce(previous_claims,''), true);
  raise;
end $$;
-- Ownership narrows the execution role; it is not postgres/service_role.
grant create on schema mcp_private to tb_mcp_reader;
grant tb_mcp_reader to postgres;
alter function mcp_private.read_finance_v1(text,text,text,jsonb,integer,integer) owner to tb_mcp_reader;
revoke tb_mcp_reader from postgres;
revoke create on schema mcp_private from tb_mcp_reader;
revoke all on function mcp_private.read_finance_v1(text,text,text,jsonb,integer,integer) from public, anon, authenticated;
grant execute on function mcp_private.read_finance_v1(text,text,text,jsonb,integer,integer) to service_role;
create function public.mcp_read_finance_v1(p_hash text,p_resource text,p_table text,p_filters jsonb,p_offset integer,p_limit integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select mcp_private.read_finance_v1(p_hash,p_resource,p_table,p_filters,p_offset,p_limit);
$$;
revoke all on function public.mcp_read_finance_v1(text,text,text,jsonb,integer,integer) from public, anon, authenticated;
grant execute on function public.mcp_read_finance_v1(text,text,text,jsonb,integer,integer) to service_role;

create table mcp_private.request_quota (key text not null, minute timestamptz not null, count integer not null, primary key(key,minute));
alter table mcp_private.request_quota enable row level security;
revoke all on mcp_private.request_quota from public, anon, authenticated;
grant select,insert,update,delete on mcp_private.request_quota to service_role;
create index mcp_quota_minute on mcp_private.request_quota(minute);
create function public.mcp_reserve_request_v1(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer; begin
  if length(p_key) > 100 or p_key is null or p_limit is null or p_limit not between 1 and 120 then return false; end if;
  delete from mcp_private.request_quota where minute < clock_timestamp() - interval '2 minutes';
  -- Expired credentials only. Used refresh hashes are kept for the entire live family.
  delete from mcp_private.oauth_grants where expires_at < clock_timestamp()
    or (not code_used and code_expires_at < clock_timestamp() - interval '1 day');
  insert into mcp_private.request_quota values (p_key,date_trunc('minute',clock_timestamp()),1)
    on conflict (key,minute) do update set count = mcp_private.request_quota.count+1
      where mcp_private.request_quota.count < p_limit returning count into n;
  return n is not null;
end $$;
revoke all on function public.mcp_reserve_request_v1(text,integer) from public, anon, authenticated;
grant execute on function public.mcp_reserve_request_v1(text,integer) to service_role;

create function public.mcp_list_grants_v1(p_user_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'client_id',client_id,'created_at',created_at,'expires_at',expires_at) order by created_at desc),'[]'::jsonb)
  from mcp_private.oauth_grants where user_id=p_user_id and code_used and revoked_at is null and expires_at>clock_timestamp();
$$;
revoke all on function public.mcp_list_grants_v1(uuid) from public, anon, authenticated;
grant execute on function public.mcp_list_grants_v1(uuid) to service_role;
