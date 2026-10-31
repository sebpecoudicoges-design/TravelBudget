// Server-side OAuth lifecycle only. No HTTP endpoint or browser session storage.
// The host must verify the TravelBudget session before authorize/revokeOwned.
const SCOPE = 'finance:read';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export async function mcpTokenHash(value) {
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
export class McpOAuthError extends Error {
  constructor(code) { super(code); this.name = 'McpOAuthError'; this.code = code; }
}
const fail = code => { throw new McpOAuthError(code); };
function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash; }
  catch { return false; }
}
function fields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) fail('invalid_request');
}

// No default production client: registration must supply exact, reviewed callbacks.
// store.run is an atomic server-only persistence operation; never use a browser client.
// verifySession must perform server-side authentication (not decode an unverified JWT).
// isUserAllowed must check current server-owned permissions; no user_metadata decisions.
export function createMcpOAuthService({ store, resource, clients, verifySession, isUserAllowed }) {
  if (!store?.run || !httpsUrl(resource) || !Array.isArray(clients) || !clients.length ||
      typeof verifySession !== 'function' || typeof isUserAllowed !== 'function') throw new Error('MCP OAuth server configuration required');
  const registered = new Map();
  for (const client of clients) {
    if (!client.id || typeof client.id !== 'string' || client.id.length > 200 || registered.has(client.id) ||
        !Array.isArray(client.redirectUris) || !client.redirectUris.length || !client.redirectUris.every(httpsUrl)) throw new Error('Invalid MCP OAuth client');
    registered.set(client.id, new Set(client.redirectUris));
  }
  function binding(input, redirect = false) {
    if (!registered.has(input.client_id)) fail('invalid_client');
    if (input.resource !== resource) fail('invalid_target');
    if (redirect && !registered.get(input.client_id).has(input.redirect_uri)) fail('invalid_request');
  }
  async function owner(session, requireAllowed = true) {
    const userId = await verifySession(session);
    if (!UUID.test(userId || '') || (requireAllowed && !await isUserAllowed(userId))) fail('access_denied');
    return userId;
  }
  async function credentials() {
    const access = `tbm_a_${random()}`, refresh = `tbm_r_${random()}`;
    return { access, refresh, access_hash: await mcpTokenHash(access), refresh_hash: await mcpTokenHash(refresh) };
  }
  async function exchanged(operation, input, hashes) {
    const next = await credentials();
    const result = await store.run(operation, { ...hashes, client_id: input.client_id, resource,
      access_hash: next.access_hash, refresh_hash: next.refresh_hash });
    if (!result || !UUID.test(result.user_id || '') || !await isUserAllowed(result.user_id)) {
      if (result?.grant_id) await store.run('revoke_owner', { grant_id: result.grant_id, user_id: result.user_id });
      fail('invalid_grant');
    }
    return { access_token: next.access, refresh_token: next.refresh, token_type: 'Bearer', expires_in: result.expires_in, scope: SCOPE };
  }
  return {
    async authorize(session, input) {
      fields(input, ['client_id', 'redirect_uri', 'resource', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method', 'approved']);
      binding(input, true);
      if (input.response_type !== 'code' || input.scope !== SCOPE || input.code_challenge_method !== 'S256' ||
          !SECRET.test(input.code_challenge || '') || typeof input.state !== 'string' || !input.state.length || input.state.length > 1024) fail('invalid_request');
      const userId = await owner(session);
      // Require an explicit consent result bound to this request by the HTTP host's CSRF protection.
      if (input.approved !== true) fail('access_denied');
      const code = `tbm_c_${random()}`;
      const saved = await store.run('authorize', { user_id: userId, client_id: input.client_id, redirect_uri: input.redirect_uri,
        resource, challenge: input.code_challenge, code_hash: await mcpTokenHash(code) });
      if (!UUID.test(saved?.grant_id || '')) throw new Error('MCP authorization storage unavailable');
      const redirect = new URL(input.redirect_uri);
      redirect.searchParams.set('code', code);
      redirect.searchParams.set('state', input.state);
      return { redirect_uri: redirect.href };
    },
    async exchange(input) {
      fields(input, ['grant_type', 'client_id', 'redirect_uri', 'resource', 'code', 'code_verifier']);
      binding(input, true);
      if (input.grant_type !== 'authorization_code' || !/^tbm_c_[A-Za-z0-9_-]{43}$/.test(input.code || '') || !VERIFIER.test(input.code_verifier || '')) fail('invalid_grant');
      return exchanged('exchange', input, { code_hash: await mcpTokenHash(input.code), challenge: await mcpTokenHash(input.code_verifier), redirect_uri: input.redirect_uri });
    },
    async refresh(input) {
      fields(input, ['grant_type', 'client_id', 'resource', 'refresh_token']);
      binding(input);
      if (input.grant_type !== 'refresh_token' || !/^tbm_r_[A-Za-z0-9_-]{43}$/.test(input.refresh_token || '')) fail('invalid_grant');
      return exchanged('refresh', input, { previous_hash: await mcpTokenHash(input.refresh_token) });
    },
    async authenticate(authorization) {
      if (typeof authorization !== 'string' || !/^Bearer tbm_a_[A-Za-z0-9_-]{43}$/.test(authorization)) fail('invalid_token');
      const result = await store.run('authenticate', { access_hash: await mcpTokenHash(authorization.slice(7)), resource });
      if (!result || !registered.has(result.client_id) || result.scope !== SCOPE || !UUID.test(result.user_id || '') || !await isUserAllowed(result.user_id)) fail('invalid_token');
      return Object.freeze({ userId: result.user_id, grantId: result.grant_id, scope: SCOPE });
    },
    async revokeOwned(session, grantId) {
      const userId = await owner(session, false);
      if (!UUID.test(grantId || '')) fail('invalid_request');
      await store.run('revoke_owner', { user_id: userId, grant_id: grantId });
    },
    async revoke(input) {
      fields(input, ['client_id', 'resource', 'token']);
      binding(input);
      if (typeof input.token !== 'string' || !/^tbm_[ar]_[A-Za-z0-9_-]{43}$/.test(input.token)) return;
      // Idempotent, including unknown tokens; no credential enumeration response.
      await store.run('revoke_token', { client_id: input.client_id, resource, token_hash: await mcpTokenHash(input.token) });
    },
  };
}
