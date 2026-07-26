import {
  adminClient,
  authenticatedUser,
  collectAccountData,
  corsHeaders,
  json,
} from "../_shared/account-data.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  try {
    const admin = adminClient();
    const user = await authenticatedUser(req, admin);
    return json(await collectAccountData(admin, user.id, user.email));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message === "AUTH_REQUIRED" ? "Unauthorized" : message }, message === "AUTH_REQUIRED" ? 401 : 500);
  }
});
