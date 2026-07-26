import {
  adminClient,
  corsHeaders,
  json,
  purgeAccount,
} from "../_shared/account-data.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("ACCOUNT_DELETION_PROCESSOR_SECRET");
  const receivedSecret = req.headers.get("x-account-deletion-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) return json({ error: "Unauthorized" }, 401);

  const admin = adminClient();
  const { data: requests, error } = await admin
    .from("account_deletion_requests")
    .select("id,user_id")
    .eq("status", "pending")
    .lte("execute_after", new Date().toISOString())
    .not("user_id", "is", null)
    .limit(10);
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const request of requests || []) {
    const startedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from("account_deletion_requests")
      .update({ status: "processing", processing_started_at: startedAt, updated_at: startedAt })
      .eq("id", request.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const result = await purgeAccount(admin, request.user_id);
      await admin
        .from("account_deletion_requests")
        .update({
          status: "completed",
          user_id: null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      results.push({ id: request.id, status: "completed", ...result });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      await admin
        .from("account_deletion_requests")
        .update({ status: "failed", failure_reason: message.slice(0, 1000), updated_at: new Date().toISOString() })
        .eq("id", request.id);
      results.push({ id: request.id, status: "failed", error: message });
    }
  }

  return json({ processed: results.length, results });
});
