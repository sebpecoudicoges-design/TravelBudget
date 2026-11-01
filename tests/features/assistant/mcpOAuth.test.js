import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createMcpOAuthService, mcpTokenHash } from '../../../supabase/functions/_shared/mcp-oauth.js';
import { createMcpOAuthStore } from '../../../supabase/functions/_shared/mcp-oauth-store.js';
import { createMcpIdentityVerifier } from '../../../supabase/functions/_shared/mcp-identity.js';

const USER = '11111111-1111-4111-8111-111111111111';
const GRANT = '22222222-2222-4222-8222-222222222222';
const RESOURCE = 'https://budget.example/mcp';
const CALLBACK = 'https://chat.example/oauth/callback';
const VERIFIER = 'a'.repeat(43);
const binding = { client_id: 'chatgpt-pilot', resource: RESOURCE };
const identity = { grant_id: GRANT, user_id: USER, client_id: binding.client_id, scope: 'finance:read', expires_in: 900 };
function setup(overrides = {}) {
  const run = vi.fn(async () => identity);
  const verifySession = vi.fn(async session => session === 'verified-session' ? USER : null);
  const isUserAllowed = vi.fn(async () => true);
  const service = createMcpOAuthService({ store: { run }, resource: RESOURCE,
    clients: [{ id: binding.client_id, redirectUris: [CALLBACK] }], verifySession, isUserAllowed, ...overrides });
  return { service, run, verifySession, isUserAllowed };
}
async function authorization(extra = {}) {
  return { ...binding, redirect_uri: CALLBACK, response_type: 'code', scope: 'finance:read', state: 'random-client-state',
    code_challenge: await mcpTokenHash(VERIFIER), code_challenge_method: 'S256', approved: true, ...extra };
}
async function exchange(service) {
  const result = await service.authorize('verified-session', await authorization());
  const code = new URL(result.redirect_uri).searchParams.get('code');
  return service.exchange({ ...binding, grant_type: 'authorization_code', redirect_uri: CALLBACK, code, code_verifier: VERIFIER });
}

it('binds consent to the verified owner and stores only hashes, preserving callback state', async () => {
  const { service, run } = setup();
  const result = await service.authorize('verified-session', await authorization());
  const redirect = new URL(result.redirect_uri);
  const code = redirect.searchParams.get('code');
  expect(redirect.searchParams.get('state')).toBe('random-client-state');
  expect(code).toMatch(/^tbm_c_[A-Za-z0-9_-]{43}$/);
  expect(run).toHaveBeenCalledWith('authorize', expect.objectContaining({ user_id: USER, code_hash: await mcpTokenHash(code) }));
  expect(JSON.stringify(run.mock.calls)).not.toContain(code);
  expect(JSON.stringify(run.mock.calls)).not.toContain('verified-session');
});

it.each([
  { redirect_uri: 'https://chat.example.evil/oauth/callback' }, { redirect_uri: CALLBACK + '?extra=x' },
  { resource: 'https://other.example/mcp' }, { client_id: 'unknown' }, { code_challenge_method: 'plain' },
  { code_challenge: 'bad' }, { response_type: 'token' }, { scope: 'finance:write' }, { state: '' },
  { approved: false }, { approved: 'true' }, { user_id: USER },
  { ui_locales: {} }, { ui_locales: 'a'.repeat(257) }, { ui_locales: 'fr\nFR' },
])('refuses unauthorized consent input before persistence: %j', async extra => {
  const { service, run } = setup();
  await expect(service.authorize('verified-session', await authorization(extra))).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
});

it('rejects unverified sessions and a user outside the pilot', async () => {
  const { service, run, isUserAllowed } = setup();
  await expect(service.authorize('forged-jwt', await authorization())).rejects.toThrow('access_denied');
  isUserAllowed.mockResolvedValue(false);
  await expect(service.authorize('verified-session', await authorization())).rejects.toThrow('access_denied');
  expect(run).not.toHaveBeenCalled();
});

it('issues opaque credentials, supplies PKCE to the atomic exchange, and verifies every access', async () => {
  const { service, run } = setup();
  const tokens = await exchange(service);
  expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 900, scope: 'finance:read' });
  expect(tokens.access_token).toMatch(/^tbm_a_[A-Za-z0-9_-]{43}$/);
  expect(tokens.refresh_token).toMatch(/^tbm_r_[A-Za-z0-9_-]{43}$/);
  expect(tokens.access_token).not.toContain('.');
  expect(run.mock.calls[1][1]).toMatchObject({ challenge: await mcpTokenHash(VERIFIER), access_hash: await mcpTokenHash(tokens.access_token) });
  expect(JSON.stringify(run.mock.calls)).not.toContain(tokens.access_token);
  expect(JSON.stringify(run.mock.calls)).not.toContain(tokens.refresh_token);
  const context = await service.authenticate(`Bearer ${tokens.access_token}`);
  expect(context).toEqual({ userId: USER, grantId: GRANT, scope: 'finance:read' });
  expect(Object.isFrozen(context)).toBe(true);
  run.mockResolvedValue(null);
  await expect(service.authenticate(`Bearer ${tokens.access_token}`)).rejects.toThrow('invalid_token');
});

it('rejects application JWTs, refresh tokens and malformed bearer headers as access credentials', async () => {
  const { service, run } = setup();
  for (const token of ['Bearer eyJ.header.signature', 'Bearer tbm_r_' + VERIFIER, 'tbm_a_' + VERIFIER, '', null]) {
    await expect(service.authenticate(token)).rejects.toThrow('invalid_token');
  }
  expect(run).not.toHaveBeenCalled();
});

it('checks current pilot permission and scope even for a previously issued credential', async () => {
  const { service, run, isUserAllowed } = setup();
  const tokens = await exchange(service);
  isUserAllowed.mockResolvedValue(false);
  await expect(service.authenticate(`Bearer ${tokens.access_token}`)).rejects.toThrow('invalid_token');
  isUserAllowed.mockResolvedValue(true);
  run.mockResolvedValue({ ...identity, scope: 'finance:write' });
  await expect(service.authenticate(`Bearer ${tokens.access_token}`)).rejects.toThrow('invalid_token');
  run.mockResolvedValue({ ...identity, client_id: 'removed-client' });
  await expect(service.authenticate(`Bearer ${tokens.access_token}`)).rejects.toThrow('invalid_token');
});

it('rotates credentials and fails closed when persistence rejects a replay or expired grant', async () => {
  const { service, run } = setup();
  const original = await exchange(service);
  const input = { ...binding, grant_type: 'refresh_token', refresh_token: original.refresh_token };
  const rotated = await service.refresh(input);
  expect(rotated.access_token).not.toBe(original.access_token);
  expect(rotated.refresh_token).not.toBe(original.refresh_token);
  expect(run.mock.lastCall[1].previous_hash).toBe(await mcpTokenHash(original.refresh_token));
  run.mockResolvedValue(null);
  await expect(service.refresh(input)).rejects.toThrow('invalid_grant');
});

it('keeps owner revocation available after the owner loses pilot access', async () => {
  const { service, run, isUserAllowed } = setup();
  isUserAllowed.mockResolvedValue(false);
  await service.revokeOwned('verified-session', GRANT);
  expect(run).toHaveBeenCalledWith('revoke_owner', { user_id: USER, grant_id: GRANT });
  await expect(service.revokeOwned('invalid-session', GRANT)).rejects.toThrow('access_denied');
});

it('revokes token families without exposing unknown-token existence', async () => {
  const { service, run } = setup();
  await service.revoke({ ...binding, token: 'bad' });
  expect(run).not.toHaveBeenCalled();
  const token = 'tbm_r_' + VERIFIER;
  run.mockResolvedValue(null);
  expect(await service.revoke({ ...binding, token })).toBeUndefined();
  expect(run).toHaveBeenCalledWith('revoke_token', { ...{ client_id: binding.client_id, resource: RESOURCE }, token_hash: await mcpTokenHash(token) });
  await service.revoke({ client_id: binding.client_id, token, token_type_hint: 'refresh_token' });
  expect(run.mock.lastCall[1].resource).toBe(RESOURCE);
});

it('redacts database errors and requires successful persistence before producing a code', async () => {
  const store = createMcpOAuthStore({ rpc: async () => ({ error: { message: 'sensitive database detail' } }) });
  await expect(store.run('authorize', {})).rejects.toThrow('MCP authorization storage unavailable');
  const { service, run } = setup();
  run.mockResolvedValue(null);
  await expect(service.authorize('verified-session', await authorization())).rejects.toThrow('storage unavailable');
});

describe('persistence boundary contract', () => {
  it('keeps new storage private, denies public RPC execution and serializes exchange/rotation', () => {
    const sql = fs.readFileSync('supabase/migrations/20261031230109_mcp_oauth_grants.sql', 'utf8');
    expect(sql).toContain('security invoker');
    expect(sql).toContain('revoke all on function public.mcp_oauth_state_v1(text, jsonb) from public, anon, authenticated');
    expect(sql).toContain('revoke all on schema mcp_private from public, anon, authenticated');
    expect(sql).toContain('for update of grants');
    expect(sql).toContain("where code_hash = p_input->>'code_hash' for update");
    expect(sql.replace(/--[^\n]*/g, '')).not.toMatch(/security\s+definer/i);
  });
});

it('verifies the application session remotely and denies pilot access by default', async () => {
  const auth = { getUser: vi.fn(async () => ({ data: { user: { id: USER } } })),
    admin: { getUserById: vi.fn(async () => ({ data: { user: { id: USER, user_metadata: { role: 'admin' } } } })) } };
  const verifier = createMcpIdentityVerifier(auth);
  expect(await verifier.verifySession('Bearer application-jwt')).toBe(USER);
  expect(auth.getUser).toHaveBeenCalledWith('application-jwt');
  expect(await verifier.isUserAllowed(USER)).toBe(false);
  expect(auth.admin.getUserById).not.toHaveBeenCalled();
  auth.getUser.mockResolvedValue({ error: { message: 'invalid signature' } });
  expect(await verifier.verifySession('Bearer forged-jwt')).toBe(null);
});

it('rechecks pilot account suspension, deletion and identity on every call', async () => {
  const auth = { getUser: vi.fn(), admin: { getUserById: vi.fn(async () => ({ data: { user: { id: USER } } })) } };
  const verifier = createMcpIdentityVerifier(auth, [USER]);
  expect(await verifier.isUserAllowed(USER)).toBe(true);
  for (const user of [{ id: GRANT }, { id: USER, banned_until: '2999-01-01' }, { id: USER, deleted_at: '2026-01-01' }, { id: USER, is_anonymous: true }, null]) {
    auth.admin.getUserById.mockResolvedValue({ data: { user } });
    expect(await verifier.isUserAllowed(USER)).toBe(false);
  }
  auth.admin.getUserById.mockResolvedValue({ error: { message: 'unavailable' } });
  expect(await verifier.isUserAllowed(USER)).toBe(false);
});
