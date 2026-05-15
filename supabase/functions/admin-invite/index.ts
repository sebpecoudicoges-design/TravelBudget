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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";

    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization bearer token" }, 401);
    }

    const { email, redirectTo } = (await req.json().catch(() => ({}))) as Partial<ReqPayload>;
    if (!email || typeof email !== "string") {
      return json({ error: "Missing/invalid email" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceRoleKey) {
      return json({
        error: "Missing env vars. Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
      }, 500);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerId = userData.user.id;

    const { data: profile, error: profErr } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (profErr) {
      return json({ error: "Cannot read profile role" }, 500);
    }
    if (profile?.role !== "admin") {
      return json({ error: "Forbidden (admin only)" }, 403);
    }

    const adminClient = createClient(url, serviceRoleKey);

    const { data: invited, error: invErr } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectTarget(redirectTo),
      });

    if (invErr) {
      return json({ error: invErr.message }, 400);
    }

    return json({ ok: true, invited_user_id: invited.user?.id ?? null }, 200);
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
