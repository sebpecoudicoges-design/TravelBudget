import {
  adminClient,
  corsHeaders,
  json,
  purgeAccount,
} from "../_shared/account-data.ts";

import { processAccountDeletions } from "./processor.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("ACCOUNT_DELETION_PROCESSOR_SECRET");
  const receivedSecret = req.headers.get("x-account-deletion-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) return json({ error: "Unauthorized" }, 401);

  try {
    return json(await processAccountDeletions(adminClient(), purgeAccount));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
