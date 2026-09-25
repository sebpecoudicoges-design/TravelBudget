-- Only the authenticated Edge handler can reserve requests using service_role.
-- One current UTC-day counter per user plus a global counter; no prompts stored.
create table public.assistant_request_quota (
  scope text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  quota_day date not null,
  requests integer not null check (requests >= 0)
);
alter table public.assistant_request_quota enable row level security;
revoke all on public.assistant_request_quota from public, anon, authenticated;
grant select, insert, update, delete on public.assistant_request_quota to service_role;

create function public.reserve_assistant_request(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_scope text;
  v_limit integer;
  v_count integer;
  v_day date := (now() at time zone 'UTC')::date;
begin
  if p_user_id is null then return false; end if;
  -- Fixed lock order prevents deadlocks. Exception rolls back both reservations.
  foreach v_scope in array array['global', p_user_id::text] loop
    v_limit := case when v_scope = 'global' then 100 else 20 end;
    insert into public.assistant_request_quota as q (scope, user_id, quota_day, requests)
      values (v_scope, case when v_scope = 'global' then null else p_user_id end, v_day, 1)
      on conflict (scope) do update
      set quota_day = v_day,
          requests = case when q.quota_day = v_day then q.requests + 1 else 1 end
      where q.quota_day <> v_day or q.requests < v_limit
      returning requests into v_count;
    if not found then raise exception 'ASSISTANT_QUOTA_REACHED'; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.reserve_assistant_request(uuid) from public, anon, authenticated;
grant execute on function public.reserve_assistant_request(uuid) to service_role;
