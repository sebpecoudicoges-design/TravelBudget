-- Run after the migration. All fixtures and state changes are rolled back.
-- Synthetic auth users only; no financial rows created or read.
begin;
insert into auth.users(id) values
  ('a0010000-0000-4000-8000-000000000001'), ('a0010000-0000-4000-8000-000000000002');

do $$
begin
  if has_schema_privilege('anon', 'mcp_private', 'usage') or has_schema_privilege('authenticated', 'mcp_private', 'usage') then
    raise exception 'MCP private schema exposed';
  end if;
  if has_function_privilege('anon', 'public.mcp_oauth_state_v1(text,jsonb)', 'execute') or
     has_function_privilege('authenticated', 'public.mcp_oauth_state_v1(text,jsonb)', 'execute') then
    raise exception 'MCP state RPC exposed';
  end if;
end $$;

set local role anon;
do $$
begin
  begin
    perform public.mcp_oauth_state_v1('authorize', '{}'::jsonb);
    raise exception 'Anonymous call unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform public.mcp_oauth_state_v1('authenticate', '{}'::jsonb);
    raise exception 'Authenticated direct call unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role service_role;
do $$
declare
  owner_id uuid := 'a0010000-0000-4000-8000-000000000001';
  other_id uuid := 'a0010000-0000-4000-8000-000000000002';
  grant_id uuid;
  b jsonb := jsonb_build_object('client_id', 'pilot', 'resource', 'https://budget.example/mcp');
  a jsonb;
  e jsonb;
  r jsonb;
begin
  a := b || jsonb_build_object('user_id', owner_id, 'redirect_uri', 'https://chat.example/callback',
    'challenge', repeat('c',43), 'code_hash', repeat('a',43));
  grant_id := (public.mcp_oauth_state_v1('authorize', a)->>'grant_id')::uuid;
  e := b || jsonb_build_object('code_hash', repeat('a',43), 'redirect_uri', 'https://chat.example/callback',
    'challenge', repeat('c',43), 'access_hash', repeat('d',43), 'refresh_hash', repeat('e',43));
  if public.mcp_oauth_state_v1('exchange', e || '{"challenge":"wrong"}'::jsonb) is not null then raise exception 'PKCE bypass'; end if;
  if public.mcp_oauth_state_v1('exchange', e || '{"client_id":"other"}'::jsonb) is not null then raise exception 'Client bypass'; end if;
  if public.mcp_oauth_state_v1('exchange', e || '{"resource":"https://other.example"}'::jsonb) is not null then raise exception 'Resource bypass'; end if;
  if public.mcp_oauth_state_v1('exchange', e || '{"redirect_uri":"https://evil.example"}'::jsonb) is not null then raise exception 'Redirect bypass'; end if;
  r := public.mcp_oauth_state_v1('exchange', e);
  if r->>'user_id' is distinct from owner_id::text then raise exception 'Owner lost'; end if;
  if public.mcp_oauth_state_v1('authenticate', b || jsonb_build_object('access_hash',repeat('d',43))) is null then raise exception 'Valid token denied'; end if;
  perform public.mcp_oauth_state_v1('revoke_owner', jsonb_build_object('user_id',other_id,'grant_id',grant_id));
  if public.mcp_oauth_state_v1('authenticate', b || jsonb_build_object('access_hash',repeat('d',43))) is null then raise exception 'Other user revoked owner'; end if;
  r := public.mcp_oauth_state_v1('refresh', b || jsonb_build_object('previous_hash',repeat('e',43),'access_hash',repeat('f',43),'refresh_hash',repeat('g',43)));
  if r is null then raise exception 'Refresh failed'; end if;
  if public.mcp_oauth_state_v1('authenticate', b || jsonb_build_object('access_hash',repeat('d',43))) is not null then raise exception 'Old access survived rotation'; end if;
  if public.mcp_oauth_state_v1('authenticate', b || jsonb_build_object('access_hash',repeat('f',43))) is null then raise exception 'New access invalid'; end if;
  r := public.mcp_oauth_state_v1('refresh', b || jsonb_build_object('previous_hash',repeat('e',43),'access_hash',repeat('h',43),'refresh_hash',repeat('i',43)));
  if r is not null then raise exception 'Refresh replay allowed'; end if;
  if public.mcp_oauth_state_v1('authenticate', b || jsonb_build_object('access_hash',repeat('f',43))) is not null then raise exception 'Refresh replay did not revoke family'; end if;

  -- A new family: reused authorization code revokes the credentials already issued.
  grant_id := (public.mcp_oauth_state_v1('authorize', a || jsonb_build_object('code_hash',repeat('j',43)))->>'grant_id')::uuid;
  e := e || jsonb_build_object('code_hash',repeat('j',43),'access_hash',repeat('k',43),'refresh_hash',repeat('l',43));
  perform public.mcp_oauth_state_v1('exchange',e);
  if public.mcp_oauth_state_v1('exchange',e) is not null then raise exception 'Code replay allowed'; end if;
  if public.mcp_oauth_state_v1('authenticate',b || jsonb_build_object('access_hash',repeat('k',43))) is not null then raise exception 'Code replay did not revoke family'; end if;

  grant_id := (public.mcp_oauth_state_v1('authorize', a || jsonb_build_object('code_hash',repeat('m',43)))->>'grant_id')::uuid;
  e := e || jsonb_build_object('code_hash',repeat('m',43),'access_hash',repeat('n',43),'refresh_hash',repeat('o',43));
  update mcp_private.oauth_grants set code_expires_at = clock_timestamp() - interval '1 second' where id = grant_id;
  if public.mcp_oauth_state_v1('exchange',e) is not null then raise exception 'Expired code allowed'; end if;
  update mcp_private.oauth_grants set code_expires_at = clock_timestamp() + interval '1 minute' where id = grant_id;
  perform public.mcp_oauth_state_v1('exchange',e);
  update mcp_private.oauth_grants set access_expires_at = clock_timestamp() - interval '1 second' where id = grant_id;
  if public.mcp_oauth_state_v1('authenticate',b || jsonb_build_object('access_hash',repeat('n',43))) is not null then raise exception 'Expired access allowed'; end if;
  r := public.mcp_oauth_state_v1('refresh',b || jsonb_build_object('previous_hash',repeat('o',43),'access_hash',repeat('p',43),'refresh_hash',repeat('q',43)));
  if r is null then raise exception 'Valid refresh after access expiry denied'; end if;
  perform public.mcp_oauth_state_v1('revoke_token',b || jsonb_build_object('token_hash',repeat('o',43)));
  if public.mcp_oauth_state_v1('authenticate',b || jsonb_build_object('access_hash',repeat('p',43))) is not null then raise exception 'Revocation via old refresh failed'; end if;

  grant_id := (public.mcp_oauth_state_v1('authorize',a || jsonb_build_object('code_hash',repeat('r',43)))->>'grant_id')::uuid;
  e := e || jsonb_build_object('code_hash',repeat('r',43),'access_hash',repeat('s',43),'refresh_hash',repeat('t',43));
  perform public.mcp_oauth_state_v1('exchange',e);
  update mcp_private.oauth_grants set expires_at = clock_timestamp() - interval '1 second' where id = grant_id;
  if public.mcp_oauth_state_v1('refresh',b || jsonb_build_object('previous_hash',repeat('t',43),'access_hash',repeat('u',43),'refresh_hash',repeat('v',43))) is not null then raise exception 'Expired family refreshed'; end if;

  grant_id := (public.mcp_oauth_state_v1('authorize',a || jsonb_build_object('code_hash',repeat('w',43)))->>'grant_id')::uuid;
  e := e || jsonb_build_object('code_hash',repeat('w',43),'access_hash',repeat('x',43),'refresh_hash',repeat('y',43));
  perform public.mcp_oauth_state_v1('exchange',e);
  perform public.mcp_oauth_state_v1('revoke_owner',jsonb_build_object('user_id',owner_id,'grant_id',grant_id));
  if public.mcp_oauth_state_v1('authenticate',b || jsonb_build_object('access_hash',repeat('x',43))) is not null then raise exception 'Owner revocation failed'; end if;
end $$;
reset role;
select 'MCP OAuth SQL assertions passed (transaction must roll back)' as result;
rollback;
