import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type ReqPayload = { email: string; redirectTo?: string };

const DEFAULT_SITE_URL = "https://stunning-dieffenbachia-2b2ed0.netlify.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirectTarget(value?: string | null) {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return Deno.env.get("SITE_URL") || DEFAULT_SITE_URL;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";

    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Bearer token" }, 401);
    }

    const { email, redirectTo } = (await req.json().catch(() => ({}))) as Partial<ReqPayload>;
    if (!email || typeof email !== "string") return json({ error: "Missing/invalid email" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceRoleKey) return json({ error: "Missing env vars" }, 500);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile, error: profErr } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr) return json({ error: "Cannot read profile role" }, 500);
    if (profile?.role !== "admin") return json({ error: "Forbidden (admin only)" }, 403);

    const adminClient = createClient(url, serviceRoleKey);

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectTarget(redirectTo) },
    });

    if (error) return json({ error: error.message }, 400);

    const action_link = (data as any)?.properties?.action_link || null;
    return json({ ok: true, action_link }, 200);
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
