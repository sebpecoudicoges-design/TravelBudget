import { createClient } from 'npm:@supabase/supabase-js@2.110.6';
import { Server, createMcpHandler } from 'npm:@modelcontextprotocol/server@2.4.0';
import { createMcpOAuthService, mcpTokenHash } from '../_shared/mcp-oauth.js';
import { createMcpOAuthStore } from '../_shared/mcp-oauth-store.js';
import { createMcpIdentityVerifier } from '../_shared/mcp-identity.js';
import { createMcpHttpHandler } from '../_shared/mcp-http.js';
import { createMcpProtocol } from '../_shared/mcp-protocol.js';
import { createMcpScopedReadClient } from '../_shared/mcp-read-client.js';
import { createMcpExtensionAccess, createMcpSharingHandler } from '../_shared/mcp-extensions.js';
import { MCP_READ_TOOLS, createMcpReadToolDispatcher } from '../../../src/features/assistant/mcpReadTools.js';

const siteOrigin = 'https://stunning-dieffenbachia-2b2ed0.netlify.app';
const issuer = siteOrigin + '/mcp-auth';
const resource = siteOrigin + '/mcp';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession:false, autoRefreshToken:false } });
const allowedUsers = (Deno.env.get('MCP_ALLOWED_USERS') || '').split(',').map(value=>value.trim()).filter(Boolean);
const identity = createMcpIdentityVerifier(admin.auth,allowedUsers);
const clients = [{ id:'travelbudget-chatgpt', redirectUris:['https://chatgpt.com/connector_platform_oauth_redirect'] }];
const oauth = createMcpOAuthService({ store:createMcpOAuthStore(admin), resource, clients, ...identity });
const protocol = createMcpProtocol({ Server, createMcpHandler }, MCP_READ_TOOLS,
  async (context: {userId:string}, token:string) => createMcpReadToolDispatcher({ userId:context.userId,
    client:createMcpScopedReadClient(admin,{ userId:context.userId,tokenHash:await mcpTokenHash(token),resource }),
    ...createMcpExtensionAccess(admin,{ userId:context.userId,tokenHash:await mcpTokenHash(token),resource }) }));
Deno.serve(createMcpHttpHandler({ oauth, identity, serverClient:admin, protocol, issuer, resource, siteOrigin,
  enabled:Deno.env.get('MCP_ENABLED') === 'true',sharing:createMcpSharingHandler(admin,identity,siteOrigin),
  publicConfig:{ supabaseUrl:Deno.env.get('SUPABASE_URL'), publishableKey:'sb_publishable_xMHxyW0Cs9oRpGQsdatnyA_JIaaAC0D', clientId:'travelbudget-chatgpt' } }));
