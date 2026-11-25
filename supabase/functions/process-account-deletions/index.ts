import {
  adminClient,
  corsHeaders,
  json,
  purgeAccount,
} from "../_shared/account-data.ts";

import { accountFileDeletionReadiness, processAccountDeletions } from "./processor.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("ACCOUNT_DELETION_PROCESSOR_SECRET");
  const receivedSecret = req.headers.get("x-account-deletion-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) return json({ error: "Unauthorized" }, 401);

  if (Deno.env.get("ACCOUNT_DELETION_EXECUTION_MODE") !== "verified-drain") {
    return json({ error: "Account deletion execution disabled" }, 503);
  }

  try {
    return json(await processAccountDeletions(adminClient(), purgeAccount, undefined, accountFileDeletionReadiness));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
