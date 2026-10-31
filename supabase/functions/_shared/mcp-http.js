import { McpOAuthError, mcpTokenHash } from './mcp-oauth.js';

class HttpError extends Error { constructor(status, code) { super(code); this.status = status; } }
function parameters(params) {
  const result = Object.create(null);
  for (const [key, value] of params) {
    if (Object.hasOwn(result,key)) throw new HttpError(400,'duplicate_parameter');
    result[key] = value;
  }
  return result;
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400,'invalid_request');
  const chunks = []; let length = 0;
  let timedOut = false;
  const timeout = setTimeout(()=>{ timedOut=true; reader.cancel().catch(()=>{}); },5000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (timedOut) throw new HttpError(408,'request_timeout');
      if (done) break;
      length += value.byteLength;
      if (length > 16384) { await reader.cancel(); throw new HttpError(413,'request_too_large'); }
      chunks.push(value);
    }
  } finally { clearTimeout(timeout); reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  const text = new TextDecoder().decode(bytes);
  const type = request.headers.get('content-type')?.split(';')[0];
  if (type === 'application/x-www-form-urlencoded') return parameters(new URLSearchParams(text));
  if (type !== 'application/json') throw new HttpError(415,'unsupported_media_type');
  try { return JSON.parse(text); } catch { throw new HttpError(400,'invalid_json'); }
}

export function createMcpHttpHandler({ oauth, identity, serverClient, protocol, issuer, resource, siteOrigin, publicConfig, enabled = false }) {
  const headers = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Pragma':'no-cache',
    'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff' };
  const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...headers, ...extra } });
  async function rpc(name, args) {
    const { data, error } = await serverClient.rpc(name,args);
    if (error) throw new HttpError(503,'temporarily_unavailable');
    return data;
  }
  async function quota(key, limit) {
    if (!await rpc('mcp_reserve_request_v1', { p_key: await mcpTokenHash(key), p_limit: limit })) throw new HttpError(429,'rate_limited');
  }
  function consentOrigin(req) {
    if (req.headers.get('origin') !== siteOrigin || !req.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(403,'origin_denied');
  }
  return async request => {
    try {
      if (!enabled) return json({ error:'temporarily_unavailable' },503);
      const url = new URL(request.url);
      const allowedHosts = [siteOrigin, publicConfig.supabaseUrl].filter(Boolean).map(value=>new URL(value).hostname);
      if (!allowedHosts.includes(url.hostname)) return json({error:'host_denied'},403);
      if (url.search.length > 8192) return json({ error:'request_too_large' },413);
      const origin = request.headers.get('origin');
      if (origin && origin !== siteOrigin) return json({ error:'origin_denied' },403);
      const path = url.pathname.replace(/^\/(?:functions\/v1\/)?travelbudget-mcp(?=\/|$)/,'').replace(/^\/mcp-auth(?=\/|$)/,'');
      if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Origin':siteOrigin,'Access-Control-Allow-Headers':'authorization,content-type,mcp-protocol-version','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'}});
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      await quota('ip:'+ip,120);
      if (request.method === 'GET' && path === '/.well-known/oauth-protected-resource') return json({ resource, authorization_servers:[issuer], scopes_supported:['finance:read'], bearer_methods_supported:['header'] });
      if (request.method === 'GET' && path === '/.well-known/oauth-authorization-server') return json({ issuer,
        authorization_endpoint:issuer+'/authorize', token_endpoint:issuer+'/token', revocation_endpoint:issuer+'/revoke',
        response_types_supported:['code'], grant_types_supported:['authorization_code','refresh_token'], scopes_supported:['finance:read'],
        token_endpoint_auth_methods_supported:['none'], code_challenge_methods_supported:['S256'], authorization_response_iss_parameter_supported:true });
      if (request.method === 'GET' && path === '/config') return json({ ...publicConfig, issuer, resource });
      if (request.method === 'GET' && (path === '/authorize' || path === '/request')) {
        const input = parameters(url.searchParams);
        if (Object.hasOwn(input,'approved')) throw new HttpError(400,'invalid_request');
        oauth.validateAuthorization(input);
        if (path === '/request') return json({ client:'ChatGPT', scope:'finance:read', request:input });
        return new Response(null,{status:302,headers:{...headers,Location:siteOrigin+'/connect-chatgpt.html#'+new URLSearchParams(input)}});
      }
      if (request.method === 'POST' && path === '/authorize') {
        consentOrigin(request);
        const input = await body(request);
        oauth.validateAuthorization(input);
        let redirect;
        if (input.approved === false) {
          redirect = new URL(input.redirect_uri); redirect.searchParams.set('error','access_denied'); redirect.searchParams.set('state',input.state);
        } else {
          const userId = await identity.verifySession(request.headers.get('authorization'));
          if (!userId) throw new HttpError(401,'access_denied');
          await quota('consent:'+userId,10);
          const result = await oauth.authorize(request.headers.get('authorization'),input);
          redirect = new URL(result.redirect_uri);
        }
        redirect.searchParams.set('iss',issuer);
        return json({ redirect_uri:redirect.href });
      }
      if (request.method === 'POST' && path === '/token') {
        const input = await body(request);
        if (input?.grant_type === 'authorization_code') return json(await oauth.exchange(input));
        if (input?.grant_type === 'refresh_token') return json(await oauth.refresh(input));
        throw new HttpError(400,'unsupported_grant_type');
      }
      if (request.method === 'POST' && path === '/revoke') { await oauth.revoke(await body(request)); return json({}); }
      if ((request.method === 'GET' && path === '/connections') || (request.method === 'POST' && path === '/disconnect')) {
        if (path === '/disconnect') consentOrigin(request);
        const session = request.headers.get('authorization');
        const userId = await identity.verifySession(session);
        if (!userId) throw new HttpError(401,'access_denied');
        if (path === '/connections') return json(await rpc('mcp_list_grants_v1',{p_user_id:userId}));
        const input = await body(request);
        if (!input || Object.keys(input).some(key=>key!=='grant_id')) throw new HttpError(400,'invalid_request');
        await oauth.revokeOwned(session,input.grant_id); return json({ revoked:true });
      }
      if (path === '/mcp') {
        let context;
        const auth = request.headers.get('authorization');
        try { context = await oauth.authenticate(auth); }
        catch (error) {
          if (!(error instanceof McpOAuthError)) throw error;
          return json({ error:'invalid_token' },401,{ 'WWW-Authenticate':`Bearer resource_metadata="${siteOrigin}/.well-known/oauth-protected-resource/mcp"` });
        }
        if (request.method !== 'POST') return json({error:'method_not_allowed'},405,{Allow:'POST'});
        await quota('user:'+context.userId,30);
        // Bound streamed input before passing it to the maintained SDK.
        const input = await body(request);
        const boundedHeaders = new Headers(request.headers); boundedHeaders.delete('content-length');
        const bounded = new Request(request.url,{method:'POST',headers:boundedHeaders,body:JSON.stringify(input)});
        const response = await protocol(bounded,context,auth.slice(7));
        const responseHeaders = new Headers(response.headers);
        for (const [key,value] of Object.entries(headers)) if (key !== 'Content-Type') responseHeaders.set(key,value);
        return new Response(response.body,{status:response.status,headers:responseHeaders});
      }
      return json({error:'not_found'},404);
    } catch (error) {
      if (error instanceof HttpError) return json({error:error.message},error.status,error.status===429?{'Retry-After':'60'}:{});
      if (error instanceof McpOAuthError) return json({error:error.code},error.code==='access_denied'?403:400);
      return json({error:'temporarily_unavailable'},503);
    }
  };
}
