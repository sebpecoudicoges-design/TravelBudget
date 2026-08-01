import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const token = String(req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!url || !serviceRoleKey || !token) return json({ error: "Missing server configuration or session" }, 401);

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const callerId = authData?.user?.id;
    if (authError || !callerId) return json({ error: "Invalid session" }, 401);

    const { data: callerProfile, error: callerError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();
    if (callerError) throw callerError;
    if (String(callerProfile?.role || "").toLowerCase() !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.targetUserId || "").trim();
    const role = String(body?.role || "").trim().toLowerCase();
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) return json({ error: "Invalid target user" }, 400);
    if (!['user', 'test'].includes(role)) return json({ error: "Only user or test roles are allowed" }, 400);
    if (targetUserId === callerId) return json({ error: "Refused: admin cannot change the current account role" }, 403);

    const { data, error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", targetUserId)
      .select("id,email,role")
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Target profile not found" }, 404);
    return json({ ok: true, profile: data });
  } catch (error) {
    console.error("[admin-set-user-role] failed", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
