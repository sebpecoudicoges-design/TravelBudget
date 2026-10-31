-- Private credential registry. This migration does not activate an OAuth endpoint.
create schema mcp_private;
revoke all on schema mcp_private from public, anon, authenticated;
grant usage on schema mcp_private to service_role;

create table mcp_private.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 200),
  resource text not null,
  redirect_uri text not null,
  scope text not null default 'finance:read' check (scope = 'finance:read'),
  challenge text not null check (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  code_hash text not null unique check (code_hash ~ '^[A-Za-z0-9_-]{43}$'),
  code_expires_at timestamptz not null default (clock_timestamp() + interval '5 minutes'),
  code_used boolean not null default false,
  access_hash text unique check (access_hash ~ '^[A-Za-z0-9_-]{43}$'),
  access_expires_at timestamptz,
  refresh_hash text unique check (refresh_hash ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at timestamptz not null default (clock_timestamp() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create index mcp_oauth_grants_owner on mcp_private.oauth_grants(user_id);
create index mcp_oauth_grants_expiry on mcp_private.oauth_grants(expires_at);
create table mcp_private.refresh_history (
  token_hash text primary key check (token_hash ~ '^[A-Za-z0-9_-]{43}$'),
  grant_id uuid not null references mcp_private.oauth_grants(id) on delete cascade
);
create index mcp_refresh_history_grant on mcp_private.refresh_history(grant_id);
alter table mcp_private.oauth_grants enable row level security;
alter table mcp_private.refresh_history enable row level security;
revoke all on mcp_private.oauth_grants, mcp_private.refresh_history from public, anon, authenticated;
grant select, insert, update, delete on mcp_private.oauth_grants, mcp_private.refresh_history to service_role;

-- Invoker privileges: only the trusted server role may call this function.
-- No SECURITY DEFINER, dynamic SQL, financial reads or user-provided role changes.
create function public.mcp_oauth_state_v1(p_operation text, p_input jsonb)
returns jsonb language plpgsql security invoker
set search_path = ''
as $$
declare
  g mcp_private.oauth_grants%rowtype;
  t timestamptz;
begin
  if p_operation = 'authorize' then
    insert into mcp_private.oauth_grants(user_id, client_id, resource, redirect_uri, challenge, code_hash)
    values ((p_input->>'user_id')::uuid, p_input->>'client_id', p_input->>'resource',
      p_input->>'redirect_uri', p_input->>'challenge', p_input->>'code_hash')
    returning * into g;
    return jsonb_build_object('grant_id', g.id);
  elsif p_operation = 'exchange' then
    select * into g from mcp_private.oauth_grants where code_hash = p_input->>'code_hash' for update;
    t := clock_timestamp();
    if not found or g.revoked_at is not null or g.expires_at <= t or
      g.client_id is distinct from p_input->>'client_id' or g.resource is distinct from p_input->>'resource' or
      g.redirect_uri is distinct from p_input->>'redirect_uri' or g.challenge is distinct from p_input->>'challenge' then return null; end if;
    if g.code_used then
      update mcp_private.oauth_grants set revoked_at = t where id = g.id;
      return null; -- Commit revocation on replay; do not RAISE and roll it back.
    end if;
    if g.code_expires_at <= t then return null; end if;
    update mcp_private.oauth_grants set code_used = true, access_hash = p_input->>'access_hash',
      access_expires_at = t + interval '15 minutes', refresh_hash = p_input->>'refresh_hash'
      where id = g.id;
    insert into mcp_private.refresh_history(token_hash, grant_id) values (p_input->>'refresh_hash', g.id);
  elsif p_operation = 'refresh' then
    select grants.* into g from mcp_private.oauth_grants grants
      join mcp_private.refresh_history history on history.grant_id = grants.id
      where history.token_hash = p_input->>'previous_hash' for update of grants;
    t := clock_timestamp();
    if not found or g.revoked_at is not null or g.expires_at <= t or not g.code_used or
      g.client_id is distinct from p_input->>'client_id' or g.resource is distinct from p_input->>'resource' then return null; end if;
    if g.refresh_hash is distinct from p_input->>'previous_hash' then
      update mcp_private.oauth_grants set revoked_at = t where id = g.id;
      return null;
    end if;
    update mcp_private.oauth_grants set access_hash = p_input->>'access_hash',
      access_expires_at = least(t + interval '15 minutes', expires_at), refresh_hash = p_input->>'refresh_hash'
      where id = g.id;
    insert into mcp_private.refresh_history(token_hash, grant_id) values (p_input->>'refresh_hash', g.id);
  elsif p_operation = 'authenticate' then
    select * into g from mcp_private.oauth_grants where access_hash = p_input->>'access_hash'
      and resource = p_input->>'resource' and revoked_at is null and code_used
      and access_expires_at > clock_timestamp() and expires_at > clock_timestamp();
    if not found then return null; end if;
  elsif p_operation = 'revoke_owner' then
    update mcp_private.oauth_grants set revoked_at = coalesce(revoked_at, clock_timestamp())
      where id = (p_input->>'grant_id')::uuid and user_id = (p_input->>'user_id')::uuid;
    return null;
  elsif p_operation = 'revoke_token' then
    update mcp_private.oauth_grants grants set revoked_at = coalesce(revoked_at, clock_timestamp())
      where client_id = p_input->>'client_id' and resource = p_input->>'resource'
      and (access_hash = p_input->>'token_hash' or exists (
        select 1 from mcp_private.refresh_history history
        where history.grant_id = grants.id and history.token_hash = p_input->>'token_hash'));
    return null;
  else
    raise exception 'Unsupported MCP state operation' using errcode = '22023';
  end if;
  return jsonb_build_object('grant_id', g.id, 'user_id', g.user_id, 'client_id', g.client_id, 'scope', g.scope,
    'expires_in', least(900, greatest(0, floor(extract(epoch from (g.expires_at - clock_timestamp()))))));
end;
$$;
revoke all on function public.mcp_oauth_state_v1(text, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_oauth_state_v1(text, jsonb) to service_role;
