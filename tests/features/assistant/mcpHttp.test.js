import { expect, it, vi } from 'vitest';
import { Server, createMcpHandler } from '@modelcontextprotocol/server';
import { createMcpHttpHandler } from '../../../supabase/functions/_shared/mcp-http.js';
import { createMcpProtocol } from '../../../supabase/functions/_shared/mcp-protocol.js';
import { createMcpOAuthService, mcpTokenHash, McpOAuthError } from '../../../supabase/functions/_shared/mcp-oauth.js';
import { createMcpScopedReadClient } from '../../../supabase/functions/_shared/mcp-read-client.js';
import { MCP_READ_TOOLS, createMcpReadToolDispatcher } from '../../../src/features/assistant/mcpReadTools.js';

const ORIGIN='https://budget.example', RESOURCE=ORIGIN+'/mcp', ISSUER=ORIGIN+'/mcp-auth';
const USER='11111111-1111-4111-8111-111111111111', GRANT='22222222-2222-4222-8222-222222222222';
const CALLBACK='https://chatgpt.com/connector_platform_oauth_redirect', VERIFIER='a'.repeat(43);
function fixture() {
  let saved, accessHash;
  const identity={verifySession:vi.fn(async session=>session==='Bearer app-session'?USER:null),isUserAllowed:async()=>true};
  const run=vi.fn(async(op,input)=>{
    if(op==='authorize'){saved=input;return {grant_id:GRANT};}
    if(op==='exchange'){
      if(!saved||input.code_hash!==saved.code_hash||input.challenge!==saved.challenge)return null;
      accessHash=input.access_hash; saved=null;
      return {grant_id:GRANT,user_id:USER,expires_in:900};
    }
    if(op==='authenticate')return input.access_hash===accessHash?{user_id:USER,grant_id:GRANT,client_id:'pilot',scope:'finance:read'}:null;
    if(op==='revoke_token'||op==='revoke_owner'){accessHash=null;return null;}
  });
  const oauth=createMcpOAuthService({store:{run},resource:RESOURCE,clients:[{id:'pilot',redirectUris:[CALLBACK]}],...identity});
  const rpc=vi.fn(async(name,args)=>{
    if(name==='mcp_reserve_request_v1')return {data:true};
    if(name==='mcp_list_grants_v1')return {data:[]};
    if(name==='mcp_read_finance_v1')return {data:args.p_table==='wallets'?[{id:GRANT,user_id:USER,name:'Test',currency:'EUR',balance:100}]:[]};
    throw new Error('Unexpected RPC');
  });
  const client={rpc};
  const protocol=createMcpProtocol({Server,createMcpHandler},MCP_READ_TOOLS,async(context,token)=>createMcpReadToolDispatcher({userId:context.userId,client:createMcpScopedReadClient(client,{userId:context.userId,resource:RESOURCE,tokenHash:await mcpTokenHash(token)})}));
  const options={oauth,identity,serverClient:client,protocol,issuer:ISSUER,resource:RESOURCE,siteOrigin:ORIGIN,publicConfig:{},enabled:true};
  return {handler:createMcpHttpHandler(options),options,rpc,run,oauth};
}
function request(path,body,extra={}) {
  const headers={'content-type':'application/json',accept:'application/json, text/event-stream',...extra};
  return new Request(ORIGIN+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
}
async function authInput() {return {client_id:'pilot',resource:RESOURCE,redirect_uri:CALLBACK,response_type:'code',scope:'finance:read',state:'state-123',code_challenge:await mcpTokenHash(VERIFIER),code_challenge_method:'S256'};}
async function token(handler) {
  const result=await handler(request('/mcp-auth/authorize',{...await authInput(),approved:true},{origin:ORIGIN,authorization:'Bearer app-session'}));
  const redirect=new URL((await result.json()).redirect_uri);
  expect(redirect.searchParams.get('iss')).toBe(ISSUER);
  const response=await handler(request('/mcp-auth/token',{...{client_id:'pilot',resource:RESOURCE,redirect_uri:CALLBACK},grant_type:'authorization_code',code:redirect.searchParams.get('code'),code_verifier:VERIFIER}));
  expect(response.status).toBe(200);
  return (await response.json()).access_token;
}
async function rpcResult(response) {
  const text=await response.text();
  if(response.headers.get('content-type')?.includes('text/event-stream'))return JSON.parse(text.split('\n').find(line=>line.startsWith('data:')).slice(5));
  return JSON.parse(text);
}

it('serves matching OAuth discovery and an authentication challenge',async()=>{
  const {handler}=fixture();
  const metadata=await (await handler(request('/mcp-auth/.well-known/oauth-authorization-server'))).json();
  expect(metadata).toMatchObject({issuer:ISSUER,authorization_response_iss_parameter_supported:true,code_challenge_methods_supported:['S256']});
  const unauthorized=await handler(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'}));
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource/mcp');
  expect(unauthorized.headers.get('cache-control')).toBe('no-store');
});

it('completes consent, PKCE exchange, SDK tool listing and a scoped wallet read, then revokes',async()=>{
  const {handler,rpc}=fixture();
  const access=await token(handler);
  const auth={authorization:'Bearer '+access};
  const list=await handler(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'},auth));
  expect(list.status).toBe(200);
  const listed=await rpcResult(list);
  expect(listed.result.tools.map(tool=>tool.name)).toEqual(MCP_READ_TOOLS.map(tool=>tool.name));
  const response=await handler(request('/mcp',{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_accounts',arguments:{}}},auth));
  const result=await rpcResult(response);
  expect(JSON.parse(result.result.content[0].text).accounts[0].effective_balance).toBe(100);
  expect(rpc.mock.calls.filter(([name])=>name==='mcp_read_finance_v1').every(([,args])=>args.p_hash===undefined?false:!JSON.stringify(args).includes(access))).toBe(true);
  await handler(request('/mcp-auth/revoke',{client_id:'pilot',resource:RESOURCE,token:access}));
  expect((await handler(request('/mcp',{jsonrpc:'2.0',id:3,method:'tools/list'},auth))).status).toBe(401);
});

it('rejects cross-origin/missing-origin consent and never follows an unregistered callback',async()=>{
  const {handler,run}=fixture();
  for(const origin of ['https://evil.example',undefined]) {
    const headers={authorization:'Bearer app-session'}; if(origin)headers.origin=origin;
    expect((await handler(request('/mcp-auth/authorize',{...await authInput(),approved:true},headers))).status).toBe(403);
  }
  const bad={...await authInput(),redirect_uri:'https://evil.example/callback'};
  expect((await handler(request('/mcp-auth/authorize?'+new URLSearchParams(bad)))).status).toBe(400);
  expect(run).not.toHaveBeenCalled();
});

it('returns issuer and original state for denial without issuing a code',async()=>{
  const {handler,run}=fixture();
  const response=await handler(request('/mcp-auth/authorize',{...await authInput(),approved:false},{origin:ORIGIN}));
  const target=new URL((await response.json()).redirect_uri);
  expect(target.searchParams.get('error')).toBe('access_denied');
  expect(target.searchParams.get('state')).toBe('state-123');
  expect(target.searchParams.get('iss')).toBe(ISSUER);
  expect(run).not.toHaveBeenCalled();
});

it('rejects duplicate OAuth parameters and oversized streamed bodies',async()=>{
  const {handler}=fixture();
  const duplicate=new Request(ISSUER+'/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'client_id=pilot&client_id=attacker'});
  expect((await handler(duplicate)).status).toBe(400);
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(17000));controller.close();}});
  const oversized=new Request(ISSUER+'/token',{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'});
  expect((await handler(oversized)).status).toBe(413);
});

it('fails closed when quota storage fails, rate limit is reached or the feature is disabled',async()=>{
  const {options,rpc}=fixture();
  expect((await createMcpHttpHandler({...options,enabled:false})(request('/mcp-auth/config'))).status).toBe(503);
  rpc.mockResolvedValue({error:{message:'secret SQL detail'}});
  const failure=await createMcpHttpHandler(options)(request('/mcp-auth/config'));
  expect(failure.status).toBe(503);expect(await failure.text()).not.toContain('secret');
  rpc.mockResolvedValue({data:false});
  const limited=await createMcpHttpHandler(options)(request('/mcp-auth/config'));
  expect(limited.status).toBe(429);expect(limited.headers.get('retry-after')).toBe('60');
});

it('requires a verified application session to list or disconnect grants',async()=>{
  const {handler,rpc}=fixture();
  expect((await handler(request('/mcp-auth/connections',undefined,{authorization:'Bearer forged'}))).status).toBe(401);
  const list=await handler(request('/mcp-auth/connections',undefined,{authorization:'Bearer app-session'}));
  expect(list.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('mcp_list_grants_v1',{p_user_id:USER});
});

it('never gives the finance repository a general client or permits an owner override',async()=>{
  const client=createMcpScopedReadClient({rpc:vi.fn()},{userId:USER,tokenHash:'hash',resource:RESOURCE});
  expect(client.rpc).toBeUndefined();
  expect(client.from('wallets').update).toBeUndefined();
  expect(()=>client.from('wallets').eq('user_id',GRANT)).toThrow('Owner mismatch');
  await expect(client.from('wallets').range(0,1)).rejects.toThrow('Owner filter required');
});

it('rejects a normal application bearer as an MCP bearer',async()=>{
  const {handler,oauth}=fixture();
  await expect(oauth.authenticate('Bearer app-session')).rejects.toBeInstanceOf(McpOAuthError);
  expect((await handler(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'},{authorization:'Bearer app-session'}))).status).toBe(401);
});

it('handles the Supabase gateway path after TLS termination without accepting another host',async()=>{
  const {handler}=fixture();
  const response=await handler(new Request('http://budget.example/travelbudget-mcp/.well-known/oauth-authorization-server'));
  expect(response.status).toBe(200);expect((await response.json()).issuer).toBe(ISSUER);
  expect((await handler(new Request('https://evil.example/travelbudget-mcp/config'))).status).toBe(403);
});
