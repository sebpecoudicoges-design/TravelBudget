import {
  adminClient,
  authenticatedUser,
  corsHeaders,
  json,
} from "../_shared/account-data.ts";

const DELAY_DAYS = 7;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = adminClient();
    const user = await authenticatedUser(req, admin);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "request");

    if (action === "status") {
      const { data, error } = await admin
        .from("account_deletion_requests")
        .select("id,status,requested_at,execute_after,cancelled_at,completed_at,export_requested")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return json({ request: data || null });
    }

    if (action === "cancel") {
      const { data, error } = await admin
        .from("account_deletion_requests")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select("id,status,cancelled_at")
        .maybeSingle();
      if (error) throw error;
      return json({ cancelled: !!data, request: data || null });
    }

    if (String(body?.confirmation || "") !== "SUPPRIMER") {
      return json({ error: "Confirmation required: SUPPRIMER" }, 400);
    }

    const executeAfter = new Date(Date.now() + DELAY_DAYS * 86400000).toISOString();
    const { data: existing, error: existingError } = await admin
      .from("account_deletion_requests")
      .select("id,status,requested_at,execute_after,export_requested")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ request: existing, alreadyPending: true });

    const { data, error } = await admin
      .from("account_deletion_requests")
      .insert({
        user_id: user.id,
        status: "pending",
        execute_after: executeAfter,
        requested_from: String(body?.requestedFrom || "app") === "web" ? "web" : "app",
        export_requested: body?.exportRequested === true,
      })
      .select("id,status,requested_at,execute_after,export_requested")
      .single();
    if (error) throw error;
    return json({ request: data, cancellationWindowDays: DELAY_DAYS }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message === "AUTH_REQUIRED" ? "Unauthorized" : message }, message === "AUTH_REQUIRED" ? 401 : 500);
  }
});
