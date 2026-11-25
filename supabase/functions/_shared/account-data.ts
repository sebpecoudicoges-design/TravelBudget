import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1;

function assertAccountStoragePath(userId: string, bucket: string, path: string) {
  // Service-role Storage calls bypass object policies. Database references are
  // not authorization: accept only the formats produced by our upload paths.
  const prefix = bucket === "personal-documents" ? `${userId}/`
    : bucket === "inbox-documents" ? `whatsapp/${userId}/` : null;
  if (!prefix || typeof path !== "string" || !path.startsWith(prefix)
    || /[%\\\u0000-\u001f\u007f]/.test(path)
    || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Storage path denied: account reference outside allowed namespace");
  }
}

type OwnedTable = {
  table: string;
  column: "user_id" | "created_by" | "auth_user_id";
};

// Keep this explicit: an allow-list is safer than accepting table names from a request.
export const OWNED_TABLES: OwnedTable[] = [
  { table: "analytic_category_mappings", column: "user_id" },
  { table: "app_error_logs", column: "user_id" },
  { table: "assistant_request_quota", column: "user_id" },
  { table: "asset_documents", column: "user_id" },
  { table: "asset_owners", column: "user_id" },
  { table: "asset_transaction_links", column: "user_id" },
  { table: "assets", column: "user_id" },
  { table: "budget_segment_budget_reference_override", column: "user_id" },
  { table: "budget_segments", column: "user_id" },
  { table: "categories", column: "user_id" },
  { table: "category_subcategories", column: "user_id" },
  { table: "caution_deposits", column: "user_id" },
  { table: "document_folders", column: "user_id" },
  { table: "documents", column: "user_id" },
  { table: "fx_manual_rates", column: "user_id" },
  { table: "health_body_measurements", column: "user_id" },
  { table: "inbox_items", column: "user_id" },
  { table: "mobile_notification_campaigns", column: "created_by" },
  { table: "mobile_notification_deliveries", column: "user_id" },
  { table: "mobile_push_tokens", column: "user_id" },
  { table: "mobility_assessments", column: "user_id" },
  { table: "notification_templates", column: "user_id" },
  { table: "nutrition_foods", column: "user_id" },
  { table: "nutrition_meal_items", column: "user_id" },
  { table: "nutrition_meals", column: "user_id" },
  { table: "nutrition_sleep", column: "user_id" },
  { table: "period_budget_reference_override", column: "user_id" },
  { table: "periods", column: "user_id" },
  { table: "recurring_rules", column: "user_id" },
  { table: "settings", column: "user_id" },
  { table: "sport_exercise_favorites", column: "user_id" },
  { table: "sport_exercise_metric_history", column: "user_id" },
  { table: "sport_exercise_metrics", column: "user_id" },
  { table: "sport_load_recommendations", column: "user_id" },
  { table: "sport_programs", column: "user_id" },
  { table: "sport_session_items", column: "user_id" },
  { table: "sport_sessions", column: "user_id" },
  { table: "sport_sets", column: "user_id" },
  { table: "transaction_documents", column: "user_id" },
  { table: "transactions", column: "user_id" },
  { table: "travel_budget_reference_profile", column: "user_id" },
  { table: "travel_day_logs", column: "user_id" },
  { table: "travel_day_moves", column: "user_id" },
  { table: "travels", column: "user_id" },
  { table: "trip_expense_budget_links", column: "user_id" },
  { table: "trip_expense_documents", column: "user_id" },
  { table: "trip_expense_shares", column: "user_id" },
  { table: "trip_expenses", column: "user_id" },
  { table: "trip_groups", column: "user_id" },
  { table: "trip_invites", column: "created_by" },
  { table: "trip_members", column: "user_id" },
  { table: "trip_participants", column: "auth_user_id" },
  { table: "trip_settlement_events", column: "created_by" },
  { table: "trip_settlements", column: "user_id" },
  { table: "wallet_transfers", column: "user_id" },
  { table: "wallets", column: "user_id" },
  { table: "work_days", column: "user_id" },
  { table: "work_document_folders", column: "user_id" },
  { table: "work_engagements", column: "user_id" },
  { table: "work_income_events", column: "user_id" },
  { table: "work_status_periods", column: "user_id" },
];

// Children without a user column are exported through their user-owned parent.
export const RELATED_TABLES = [
  { table: "sport_program_sessions", parentTable: "sport_programs", parentKey: "program_id" },
  { table: "sport_program_exercises", parentTable: "sport_program_sessions", parentKey: "session_id" },
  { table: "asset_ownership_events", parentTable: "assets", parentKey: "asset_id" },
] as const;

// Children first. This also covers RESTRICT constraints before Auth is removed.
export const DELETE_ORDER: OwnedTable[] = [
  { table: "app_error_logs", column: "user_id" },
  { table: "assistant_request_quota", column: "user_id" },
  { table: "asset_transaction_links", column: "user_id" },
  { table: "asset_documents", column: "user_id" },
  { table: "asset_owners", column: "user_id" },
  { table: "trip_expense_documents", column: "user_id" },
  { table: "trip_expense_budget_links", column: "user_id" },
  { table: "trip_expense_shares", column: "user_id" },
  { table: "trip_settlement_events", column: "created_by" },
  { table: "trip_settlements", column: "user_id" },
  { table: "trip_expenses", column: "user_id" },
  { table: "trip_members", column: "user_id" },
  { table: "trip_participants", column: "auth_user_id" },
  { table: "trip_invites", column: "created_by" },
  { table: "trip_groups", column: "user_id" },
  { table: "work_document_folders", column: "user_id" },
  { table: "work_income_events", column: "user_id" },
  { table: "work_status_periods", column: "user_id" },
  { table: "work_days", column: "user_id" },
  { table: "work_engagements", column: "user_id" },
  { table: "nutrition_meal_items", column: "user_id" },
  { table: "nutrition_meals", column: "user_id" },
  { table: "nutrition_sleep", column: "user_id" },
  { table: "nutrition_foods", column: "user_id" },
  { table: "sport_exercise_metric_history", column: "user_id" },
  { table: "sport_load_recommendations", column: "user_id" },
  { table: "sport_exercise_metrics", column: "user_id" },
  { table: "sport_exercise_favorites", column: "user_id" },
  { table: "sport_sets", column: "user_id" },
  { table: "sport_session_items", column: "user_id" },
  { table: "sport_sessions", column: "user_id" },
  { table: "sport_programs", column: "user_id" },
  { table: "mobility_assessments", column: "user_id" },
  { table: "health_body_measurements", column: "user_id" },
  { table: "assets", column: "user_id" },
  { table: "transaction_documents", column: "user_id" },
  { table: "caution_deposits", column: "user_id" },
  { table: "wallet_transfers", column: "user_id" },
  { table: "transactions", column: "user_id" },
  { table: "recurring_rules", column: "user_id" },
  { table: "wallets", column: "user_id" },
  { table: "budget_segment_budget_reference_override", column: "user_id" },
  { table: "budget_segments", column: "user_id" },
  { table: "period_budget_reference_override", column: "user_id" },
  { table: "periods", column: "user_id" },
  { table: "travel_day_moves", column: "user_id" },
  { table: "travel_day_logs", column: "user_id" },
  { table: "travel_budget_reference_profile", column: "user_id" },
  { table: "travels", column: "user_id" },
  { table: "document_folders", column: "user_id" },
  { table: "documents", column: "user_id" },
  { table: "inbox_items", column: "user_id" },
  { table: "mobile_notification_deliveries", column: "user_id" },
  { table: "mobile_push_tokens", column: "user_id" },
  { table: "notification_templates", column: "user_id" },
  { table: "mobile_notification_campaigns", column: "created_by" },
  { table: "category_subcategories", column: "user_id" },
  { table: "analytic_category_mappings", column: "user_id" },
  { table: "categories", column: "user_id" },
  { table: "fx_manual_rates", column: "user_id" },
  { table: "settings", column: "user_id" },
];

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function authenticatedUser(req: Request, admin: SupabaseClient) {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) throw new Error("AUTH_REQUIRED");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return data.user;
}

async function selectAll(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string,
  stableInventory = false,
) {
  const rows: unknown[] = [];
  const seen = new Set<string>();
  const pageSize = 1000;
  const rowLimit = 50000;
  // A short page can be a server-side API cap, not the end of the result.
  while (true) {
    const from = rows.length;
    let query = admin.from(table).select("*").eq(column, value);
    if (stableInventory) query = query.order("id", { ascending: true });
    const { data, error } = await query.range(from, Math.min(from + pageSize - 1, rowLimit));
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    if (from + data.length > rowLimit) throw new Error(`${table}: row limit exceeded; account inventory incomplete`);
    if (stableInventory) {
      for (const row of data) {
        if ((typeof row.id !== "string" && typeof row.id !== "number") || seen.has(String(row.id))) {
          throw new Error(`${table}: unstable account inventory`);
        }
        seen.add(String(row.id));
      }
    } else if (data.length < pageSize) {
      // Exports for legacy tables do not assume an id column.
      rows.push(...data);
      break;
    }
    rows.push(...data);
  }
  return rows;
}

async function selectByIds(
  admin: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  requireAll = false,
) {
  if (!ids.length) return [];
  const rows: unknown[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const expected = ids.slice(offset, offset + 200);
    const { data, error } = await admin.from(table).select("*").in(column, expected);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (requireAll) {
      const found = new Set((data || []).map((row) => row[column]));
      if (!expected.every((id) => found.has(id))) throw new Error(`${table}: account inventory incomplete`);
    }
    rows.push(...(data || []));
  }
  return rows;
}

export async function collectAccountData(
  admin: SupabaseClient,
  userId: string,
  email: string | undefined,
) {
  const tables: Record<string, unknown[]> = {};
  const warnings: string[] = [];

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(`profiles: ${profileError.message}`);
  tables.profiles = profile ? [profile] : [];

  for (const spec of OWNED_TABLES) {
    try {
      tables[spec.table] = await selectAll(admin, spec.table, spec.column, userId);
    } catch (error) {
      // A staged deployment may run before the newest optional table exists.
      warnings.push(error instanceof Error ? error.message : String(error));
      tables[spec.table] = [];
    }
  }

  const linkedMemberRows = await selectAll(admin, "trip_members", "auth_user_id", userId) as any[];
  const linkedParticipantRows = await selectAll(admin, "trip_participants", "auth_user_id", userId) as any[];
  const sharedTripIds = [...new Set([
    ...(tables.trip_groups || []).map((row: any) => row.id),
    ...linkedMemberRows.map((row) => row.trip_id),
    ...linkedParticipantRows.map((row) => row.trip_id),
  ].filter(Boolean))];
  const mergeRows = (current: unknown[] = [], additional: unknown[] = []) => {
    const merged = new Map<string, unknown>();
    [...current, ...additional].forEach((row: any, index) => {
      const key = row?.id
        || `${row?.trip_id || "row"}:${row?.auth_user_id || row?.user_id || index}`;
      merged.set(String(key), row);
    });
    return [...merged.values()];
  };
  if (sharedTripIds.length) {
    tables.trip_groups = mergeRows(tables.trip_groups, await selectByIds(admin, "trip_groups", "id", sharedTripIds));
    for (const table of [
      "trip_members",
      "trip_participants",
      "trip_expenses",
      "trip_expense_shares",
      "trip_expense_budget_links",
      "trip_expense_documents",
      "trip_settlements",
      "trip_settlement_events",
      "trip_invites",
    ]) {
      tables[table] = mergeRows(tables[table], await selectByIds(admin, table, "trip_id", sharedTripIds));
    }
  }

  const programIds = (tables.sport_programs || []).map((row: any) => row.id).filter(Boolean);
  tables.sport_program_sessions = await selectByIds(admin, "sport_program_sessions", "program_id", programIds);
  const programSessionIds = tables.sport_program_sessions.map((row: any) => row.id).filter(Boolean);
  tables.sport_program_exercises = await selectByIds(admin, "sport_program_exercises", "session_id", programSessionIds);
  const assetIds = (tables.assets || []).map((row: any) => row.id).filter(Boolean);
  tables.asset_ownership_events = await selectByIds(admin, "asset_ownership_events", "asset_id", assetIds);

  const storageFiles: Array<Record<string, unknown>> = [];
  for (const document of (tables.documents || []) as any[]) {
    if (!document.storage_bucket || !document.storage_path) continue;
    assertAccountStoragePath(userId, document.storage_bucket, document.storage_path);
    const { data } = await admin.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 3600);
    storageFiles.push({
      bucket: document.storage_bucket,
      path: document.storage_path,
      filename: document.original_filename || document.name || document.storage_path.split("/").pop(),
      mimeType: document.mime_type || null,
      sizeBytes: document.size_bytes || null,
      signedUrl: data?.signedUrl || null,
      signedUrlExpiresInSeconds: data?.signedUrl ? 3600 : null,
    });
  }
  for (const item of (tables.inbox_items || []) as any[]) {
    if (!item.storage_path) continue;
    assertAccountStoragePath(userId, "inbox-documents", item.storage_path);
    const { data } = await admin.storage
      .from("inbox-documents")
      .createSignedUrl(item.storage_path, 3600);
    storageFiles.push({
      bucket: "inbox-documents",
      path: item.storage_path,
      filename: item.storage_path.split("/").pop(),
      mimeType: item.media_content_type || null,
      signedUrl: data?.signedUrl || null,
      signedUrlExpiresInSeconds: data?.signedUrl ? 3600 : null,
    });
  }

  return {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    account: { id: userId, email: email || null },
    tables,
    storageFiles,
    localDataNote: "Device-only caches and pending offline actions are exported separately by the app.",
    warnings,
  };
}

const accountStoragePrefixes = (userId: string) => [
  ["personal-documents", userId],
  ["inbox-documents", `whatsapp/${userId}`],
] as const;

async function listAccountStorage(admin: SupabaseClient, userId: string, bucket: string, root: string) {
  const storage = admin.storage.from(bucket);
  const files: string[] = [];
  const folders = [{ path: root, depth: 0 }];
  const seen = new Set<string>();
  for (let index = 0; index < folders.length; index++) {
    const { path, depth } = folders[index];
    let offset = 0;
    while (true) {
      const { data, error } = await storage.list(path, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`storage ${bucket}: ${error.message}`);
      if (!data) throw new Error(`storage ${bucket}: account inventory unavailable`);
      if (!data.length) break;
      for (const entry of data) {
        if (typeof entry.name !== "string" || entry.name.includes("/")) {
          throw new Error(`storage ${bucket}: invalid inventory entry`);
        }
        const entryPath = `${path}/${entry.name}`;
        assertAccountStoragePath(userId, bucket, entryPath);
        if (seen.has(entryPath) || seen.size >= 50000) throw new Error(`storage ${bucket}: account inventory unstable or exceeds 50000 entries`);
        seen.add(entryPath);
        if (entry.id === null) {
          if (depth >= 20) throw new Error(`storage ${bucket}: account folder depth exceeds 20`);
          folders.push({ path: entryPath, depth: depth + 1 });
        } else if (typeof entry.id === "string" && entry.id) {
          files.push(entryPath);
        } else {
          throw new Error(`storage ${bucket}: invalid inventory entry`);
        }
      }
      offset += data.length;
    }
  }
  return files;
}

export async function removeAccountStorage(
  admin: SupabaseClient,
  userId: string,
) {
  if (!/^[a-z0-9-]+$/i.test(userId)) throw new Error("Storage path denied: invalid account identifier");
  const files = new Map<string, Set<string>>();
  const add = (bucket: string, path: string) => {
    if (!bucket || !path) return;
    assertAccountStoragePath(userId, bucket, path);
    if (!files.has(bucket)) files.set(bucket, new Set());
    files.get(bucket)!.add(path);
  };

  const documents = await selectAll(admin, "documents", "user_id", userId, true) as any[];
  documents.forEach((row) => add(row.storage_bucket, row.storage_path));
  const inboxItems = await selectAll(admin, "inbox_items", "user_id", userId, true) as any[];
  inboxItems.forEach((row) => add("inbox-documents", row.storage_path));

  // An upload can succeed before its application row is committed. Inventory
  // Storage itself as well as references, but only inside the known account
  // folders. Finish both inventories before deleting a single object.
  for (const [bucket, root] of accountStoragePrefixes(userId)) {
    for (const path of await listAccountStorage(admin, userId, bucket, root)) add(bucket, path);
  }

  let removed = 0;
  for (const [bucket, paths] of files.entries()) {
    const names = [...paths];
    for (let offset = 0; offset < names.length; offset += 100) {
      const chunk = names.slice(offset, offset + 100);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (error) throw new Error(`storage ${bucket}: ${error.message}`);
      removed += chunk.length;
    }
  }
  for (const [bucket, root] of accountStoragePrefixes(userId)) {
    if ((await listAccountStorage(admin, userId, bucket, root)).length) {
      throw new Error(`storage ${bucket}: account inventory not empty after cleanup`);
    }
  }
  return removed;
}

async function preserveSharedTripGroups(admin: SupabaseClient, userId: string) {
  const ownedGroups = await selectAll(admin, "trip_groups", "user_id", userId, true) as any[];
  const ownedIds = new Set(ownedGroups.map((group) => group.id));
  // A contributor can own shared rows without owning the group or still having
  // a participant row. Discover these groups from the rows we must preserve.
  const sharedTables = ["trip_expense_documents", "trip_expense_shares", "trip_expenses", "trip_members", "trip_settlements"];
  const contributedIds = new Set<string>();
  for (const table of sharedTables) {
    const rows = await selectAll(admin, table, "user_id", userId, true) as any[];
    rows.forEach((row) => { if (row.trip_id && !ownedIds.has(row.trip_id)) contributedIds.add(row.trip_id); });
  }
  const otherGroups = await selectByIds(admin, "trip_groups", "id", [...contributedIds], true) as any[];
  const groups = [...ownedGroups, ...otherGroups];
  let transferred = 0;

  for (const group of groups) {
    const ownsGroup = ownedIds.has(group.id);
    let successorId = ownsGroup ? null : group.user_id;
    if (ownsGroup) {
      const { data: participants, error: participantsError } = await admin
        .from("trip_participants")
        .select("auth_user_id,created_at")
        .eq("trip_id", group.id)
        .neq("auth_user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (participantsError) throw new Error(`trip_participants: ${participantsError.message}`);

      successorId = participants?.[0]?.auth_user_id || null;
      if (!successorId) {
        const { data: members, error: membersError } = await admin
          .from("trip_members")
          .select("auth_user_id,created_at")
          .eq("trip_id", group.id)
          .not("auth_user_id", "is", null)
          .neq("auth_user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1);
        if (membersError) throw new Error(`trip_members: ${membersError.message}`);
        successorId = members?.[0]?.auth_user_id || null;
      }
    }
    if (!successorId) continue;

    // Personal budget links belong to their transaction owner. DELETE_ORDER
    // removes the departing user's links; never reassign another user's budget.
    for (const table of sharedTables) {
      const { error } = await admin
        .from(table)
        .update({ user_id: successorId })
        .eq("trip_id", group.id)
        .eq("user_id", userId);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    if (ownsGroup) {
      const { error: groupError } = await admin
        .from("trip_groups")
        .update({ user_id: successorId, closed_by: group.closed_by === userId ? null : group.closed_by })
        .eq("id", group.id)
        .eq("user_id", userId);
      if (groupError) throw new Error(`trip_groups: ${groupError.message}`);
      transferred += 1;
    }

    const { error: memberCleanupError } = await admin
      .from("trip_members")
      .update({ auth_user_id: null, email: null, name: "Utilisateur supprimé", is_me: false })
      .eq("trip_id", group.id)
      .eq("auth_user_id", userId);
    if (memberCleanupError) throw new Error(`trip_members: ${memberCleanupError.message}`);
    const { error: participantCleanupError } = await admin
      .from("trip_participants")
      .delete()
      .eq("trip_id", group.id)
      .eq("auth_user_id", userId);
    if (participantCleanupError) throw new Error(`trip_participants: ${participantCleanupError.message}`);
  }
  return transferred;
}

export async function purgeAccount(admin: SupabaseClient, userId: string, beforeAuthDeletion?: () => Promise<void>) {
  const storageObjectsRemoved = await removeAccountStorage(admin, userId);
  const sharedTripGroupsTransferred = await preserveSharedTripGroups(admin, userId);
  const deletedRows: Record<string, number> = {};

  for (const spec of DELETE_ORDER) {
    if (spec.table === "transactions") {
      const { data, error } = await admin.rpc("purge_account_wallet_transactions", { p_user_id: userId });
      if (error) throw new Error(`transactions: ${error.message}`);
      if (!Number.isSafeInteger(data) || data < 0) throw new Error("transactions: deletion count unavailable");
      deletedRows.transactions = data;
      continue;
    }
    // Some owned tables use another primary key (e.g. quota.scope). Count
    // mutations without requesting an id column or a capped result payload.
    const { count, error } = await admin.from(spec.table)
      .delete({ count: "exact" }).eq(spec.column, userId);
    if (error) throw new Error(`${spec.table}: ${error.message}`);
    if (count === null) throw new Error(`${spec.table}: deletion count unavailable`);
    deletedRows[spec.table] = count;
  }

  // These references deliberately preserve shared history without retaining identity.
  const { error: memberCleanupError } = await admin
    .from("trip_members")
    .update({ auth_user_id: null, email: null, name: "Utilisateur supprimé", is_me: false })
    .eq("auth_user_id", userId);
  if (memberCleanupError) throw new Error(`trip_members: ${memberCleanupError.message}`);
  const { error: ownerCleanupError } = await admin.from("asset_owners").update({ user_id: null }).eq("user_id", userId);
  if (ownerCleanupError) throw new Error(`asset_owners: ${ownerCleanupError.message}`);
  const { error: groupCleanupError } = await admin.from("trip_groups").update({ closed_by: null }).eq("closed_by", userId);
  if (groupCleanupError) throw new Error(`trip_groups: ${groupCleanupError.message}`);

  await beforeAuthDeletion?.();
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) throw new Error(`auth.users: ${authError.message}`);

  return { storageObjectsRemoved, sharedTripGroupsTransferred, deletedRows };
}
