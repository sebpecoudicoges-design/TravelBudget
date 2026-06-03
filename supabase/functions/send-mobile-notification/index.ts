import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type PushPayload = {
  user_id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  notification_key?: string;
  view?: string;
  source?: string;
  dry_run?: boolean;
  force?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tb-notification-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Url(input: ArrayBuffer | Uint8Array | string) {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const b64 = String(pem || "")
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function serviceAccount() {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";
  if (raw) {
    const parsed = JSON.parse(raw);
    return {
      projectId: String(parsed.project_id || Deno.env.get("FCM_PROJECT_ID") || ""),
      clientEmail: String(parsed.client_email || ""),
      privateKey: String(parsed.private_key || ""),
    };
  }

  return {
    projectId: String(Deno.env.get("FCM_PROJECT_ID") || ""),
    clientEmail: String(Deno.env.get("FCM_CLIENT_EMAIL") || ""),
    privateKey: String(Deno.env.get("FCM_PRIVATE_KEY") || ""),
  };
}

async function getAccessToken() {
  const account = serviceAccount();
  if (!account.projectId || !account.clientEmail || !account.privateKey) {
    throw new Error("Missing FCM service account env. Set FCM_SERVICE_ACCOUNT_JSON or FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: account.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.access_token) {
    throw new Error(`FCM OAuth failed: ${data?.error_description || data?.error || resp.status}`);
  }
  return { token: String(data.access_token), projectId: account.projectId };
}

function stringifyData(data: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

async function caller(req: Request, url: string, anonKey: string, serviceRoleKey: string) {
  const internalSecret = Deno.env.get("MOBILE_PUSH_INTERNAL_SECRET") || "";
  const providedSecret = req.headers.get("x-tb-notification-secret") || "";
  if (internalSecret && providedSecret && providedSecret === internalSecret) {
    return { mode: "internal", userId: "", isAdmin: true };
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { mode: "none", userId: "", isAdmin: false };

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) return { mode: "none", userId: "", isAdmin: false };

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  return {
    mode: "user",
    userId: userData.user.id,
    isAdmin: String(profile?.role || "").toLowerCase() === "admin",
  };
}

function fcmBody(token: string, payload: Required<Pick<PushPayload, "title" | "body">> & PushPayload) {
  const notificationKey = String(payload.notification_key || payload.data?.notificationKey || payload.data?.notification_key || `${payload.source || "app"}:${Date.now()}`);
  const data = stringifyData({
    ...(payload.data || {}),
    notificationKey,
    notification_key: notificationKey,
    source: payload.source || "travelbudget",
    view: payload.view || payload.data?.view || "inbox",
  });

  return {
    message: {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data,
      android: {
        priority: "HIGH",
        notification: {
          channel_id: "travelbudget",
          click_action: "OPEN_TRAVELBUDGET",
        },
      },
    },
  };
}

function prefKeyForPayload(payload: PushPayload) {
  const source = String(payload.source || payload.data?.source || "").toLowerCase();
  const view = String(payload.view || payload.data?.view || "").toLowerCase();
  const kind = String(payload.data?.kind || "").toLowerCase();
  if (source.includes("daily") || kind.includes("daily")) return "dailyBudget";
  if (source.includes("low_budget") || source.includes("low-budget") || kind.includes("low_budget")) return "lowBudget";
  if (source.includes("trip") || kind.includes("trip") || view === "trip") return "trip";
  if (source.includes("inbox") || view === "inbox") return "inbox";
  return "inbox";
}

function prefEnabled(rawPrefs: unknown, key: string) {
  const prefs = rawPrefs && typeof rawPrefs === "object" ? rawPrefs as Record<string, unknown> : {};
  if (key === "dailyBudget") return prefs.dailyBudget === true;
  if (key === "trip") return prefs.trip !== false;
  if (key === "lowBudget") return prefs.lowBudget !== false;
  return prefs.inbox !== false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase env vars" }, 500);
    }

    const payload = (await req.json().catch(() => ({}))) as PushPayload;
    const auth = await caller(req, supabaseUrl, anonKey, serviceRoleKey);
    if (auth.mode === "none") return json({ error: "Unauthorized" }, 401);

    const targetUserId = String(payload.user_id || auth.userId || "").trim();
    if (!targetUserId) return json({ error: "Missing user_id" }, 400);
    if (auth.mode === "user" && targetUserId !== auth.userId && !auth.isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }
    if (payload.force && auth.mode === "user" && !auth.isAdmin) {
      return json({ error: "Forbidden: force requires admin or internal sender" }, 403);
    }

    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    if (!title || !body) return json({ error: "Missing title/body" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const prefKey = prefKeyForPayload(payload);
    if (!payload.force) {
      const { data: settings, error: prefError } = await adminClient
        .from("settings")
        .select("notification_prefs")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (prefError) throw prefError;
      if (!prefEnabled(settings?.notification_prefs, prefKey)) {
        return json({ ok: true, sent: 0, failed: 0, skipped: true, reason: `Preference disabled: ${prefKey}` });
      }
    }

    const { data: tokens, error: tokenError } = await adminClient
      .from("mobile_push_tokens")
      .select("id,token")
      .eq("user_id", targetUserId)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(20);

    if (tokenError) throw tokenError;
    if (!tokens?.length) return json({ ok: true, sent: 0, failed: 0, message: "No active mobile token" });

    if (payload.dry_run) {
      return json({ ok: true, dry_run: true, token_count: tokens.length });
    }

    const { token: accessToken, projectId } = await getAccessToken();
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const results = [];

    for (const row of tokens) {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fcmBody(row.token, { ...payload, title, body })),
      });
      const result = await resp.json().catch(() => ({}));
      results.push({ id: row.id, ok: resp.ok, status: resp.status, result });

      const msg = JSON.stringify(result || {});
      if (!resp.ok && /UNREGISTERED|INVALID_ARGUMENT|registration-token-not-registered/i.test(msg)) {
        await adminClient
          .from("mobile_push_tokens")
          .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }

    return json({
      ok: true,
      sent: results.filter((x) => x.ok).length,
      failed: results.filter((x) => !x.ok).length,
      results,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
