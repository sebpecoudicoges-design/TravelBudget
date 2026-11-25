import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// Hosted workers live at most 400 seconds. Reclaim only after a conservative
// 30-minute interval; never enable this lease unchanged for unbounded workers.
export const DELETION_RECLAIM_MS = 30 * 60 * 1000;
export const MAX_DELETION_ATTEMPTS = 3;

export async function processAccountDeletions(
  admin: SupabaseClient,
  purge: (admin: SupabaseClient, userId: string, beforeAuthDeletion: () => Promise<void>) => Promise<Record<string, unknown>>,
  now = () => new Date(),
) {
  const cutoff = new Date(now().getTime() - DELETION_RECLAIM_MS).toISOString();
  const { data: requests, error } = await admin.from("account_deletion_requests")
    .select("id,user_id,status,processing_started_at,data_purged_at,attempt_count")
    .or(`status.eq.pending,and(status.eq.processing,processing_started_at.lt.${cutoff})`)
    .lte("execute_after", now().toISOString())
    .or("user_id.not.is.null,and(status.eq.processing,data_purged_at.not.is.null)")
    .order("execute_after", { ascending: true })
    .limit(10);
  if (error) throw error;

  const results = [];
  const recoverableFailures: unknown[] = [];
  for (const request of requests || []) {
    const attemptCount = request.user_id === null ? request.attempt_count : Math.min(request.attempt_count + 1, MAX_DELETION_ATTEMPTS);
    const startedAt = now().toISOString();
    let claim = admin.from("account_deletion_requests")
      .update({ status: "processing", processing_started_at: startedAt, updated_at: startedAt, failure_reason: null,
        data_purged_at: request.user_id === null ? request.data_purged_at : null, attempt_count: attemptCount })
      .eq("id", request.id).eq("status", request.status);
    claim = request.user_id === null ? claim.is("user_id", null) : claim.eq("user_id", request.user_id);
    if (request.status === "processing") claim = claim.eq("processing_started_at", request.processing_started_at);
    const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    const finish = async (patch: Record<string, unknown>) => {
      const { data, error: writeError } = await admin.from("account_deletion_requests")
        .update({ ...patch, updated_at: now().toISOString() })
        .eq("id", request.id).eq("status", "processing").eq("processing_started_at", startedAt)
        .select("id").maybeSingle();
      if (writeError) throw writeError;
      if (!data) throw new Error("Deletion ownership lost; status not acknowledged");
    };
    if (request.user_id === null) {
      // Only checkpointed, expired processing rows are selected above.
      await finish({ status: "completed", completed_at: now().toISOString() });
      results.push({ id: request.id, status: "completed", reconciled: true });
      continue;
    }
    let result;
    let checkpointWritten = false;
    try {
      result = await purge(admin, request.user_id, async () => {
        await finish({ data_purged_at: now().toISOString() });
        checkpointWritten = true;
      });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      if (checkpointWritten) {
        // Auth may have committed despite a lost/error response. Keep the lease
        // recoverable: later reconcile a missing user, or retry an existing one.
        await finish({ failure_reason: message.slice(0, 1000) });
        recoverableFailures.push(failure);
        continue;
      }
      // Storage and database errors can leave earlier cleanup steps committed.
      // Keep the claim recoverable, with the same cooldown as worker recovery,
      // until retries are exhausted. Keep uncertain Auth outcomes recoverable
      // regardless of this limit, since Auth may already have committed.
      const retry = attemptCount < MAX_DELETION_ATTEMPTS;
      const status = retry ? "processing" : "failed";
      await finish({ status, failure_reason: message.slice(0, 1000) });
      results.push({ id: request.id, status, retryScheduled: retry, error: message });
      continue;
    }
    // Do not turn a failed completion write into a claimed purge failure.
    await finish({ status: "completed", user_id: null, completed_at: now().toISOString() });
    results.push({ ...result, id: request.id, status: "completed" });
  }
  // Preserve the HTTP failure signal, but finish independent requests first.
  if (recoverableFailures.length === 1) throw recoverableFailures[0];
  if (recoverableFailures.length > 1) {
    throw new Error(`${recoverableFailures.length} account deletion requests need Auth reconciliation`);
  }
  return { processed: results.length, results };
}
