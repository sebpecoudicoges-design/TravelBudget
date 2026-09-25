import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createAssistantHandler } from './handler.js';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createAssistantHandler({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
  enabled: Deno.env.get('ASSISTANT_AI_ENABLED') === 'true',
  allowedUsers: (Deno.env.get('ASSISTANT_AI_ALLOWED_USERS') || '').split(',').map(id => id.trim()).filter(Boolean),
  authenticate: async (authorization: string) => {
    if (!/^Bearer \S+$/.test(authorization)) return null;
    const { data, error } = await admin.auth.getUser(authorization.slice(7));
    return error ? null : data.user?.id;
  },
  reserveQuota: async (userId: string) => {
    const { data, error } = await admin.rpc('reserve_assistant_request', { p_user_id: userId });
    return !error && data === true;
  },
}));
