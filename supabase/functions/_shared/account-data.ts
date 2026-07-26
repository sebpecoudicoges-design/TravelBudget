import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1;

type OwnedTable = {
  table: string;
  column: "user_id" | "created_by" | "auth_user_id";
};

// Keep this explicit: an allow-list is safer than accepting table names from a request.
export const OWNED_TABLES: OwnedTable[] = [
  { table: "analytic_category_mappings", column: "user_id" },
  { table: "app_error_logs", column: "user_id" },
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
) {
  const rows: unknown[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq(column, value)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}

async function selectByIds(
  admin: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows: unknown[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .in(column, ids.slice(offset, offset + 200));
    if (error) throw new Error(`${table}: ${error.message}`);
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

export async function removeAccountStorage(
  admin: SupabaseClient,
  userId: string,
) {
  const files = new Map<string, Set<string>>();
  const add = (bucket: string, path: string) => {
    if (!bucket || !path) return;
    if (!files.has(bucket)) files.set(bucket, new Set());
    files.get(bucket)!.add(path);
  };

  const documents = await selectAll(admin, "documents", "user_id", userId) as any[];
  documents.forEach((row) => add(row.storage_bucket, row.storage_path));
  const inboxItems = await selectAll(admin, "inbox_items", "user_id", userId) as any[];
  inboxItems.forEach((row) => add("inbox-documents", row.storage_path));

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
  return removed;
}

async function preserveSharedTripGroups(admin: SupabaseClient, userId: string) {
  const groups = await selectAll(admin, "trip_groups", "user_id", userId) as any[];
  let transferred = 0;

  for (const group of groups) {
    const { data: participants, error: participantsError } = await admin
      .from("trip_participants")
      .select("auth_user_id,created_at")
      .eq("trip_id", group.id)
      .neq("auth_user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (participantsError) throw new Error(`trip_participants: ${participantsError.message}`);

    let successorId = participants?.[0]?.auth_user_id || null;
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
    if (!successorId) continue;

    for (const table of [
      "trip_expense_budget_links",
      "trip_expense_documents",
      "trip_expense_shares",
      "trip_expenses",
      "trip_members",
      "trip_settlements",
    ]) {
      const { error } = await admin
        .from(table)
        .update({ user_id: successorId })
        .eq("trip_id", group.id)
        .eq("user_id", userId);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    const { error: groupError } = await admin
      .from("trip_groups")
      .update({ user_id: successorId, closed_by: group.closed_by === userId ? null : group.closed_by })
      .eq("id", group.id)
      .eq("user_id", userId);
    if (groupError) throw new Error(`trip_groups: ${groupError.message}`);

    await admin
      .from("trip_members")
      .update({ auth_user_id: null, email: null, name: "Utilisateur supprimé", is_me: false })
      .eq("trip_id", group.id)
      .eq("auth_user_id", userId);
    await admin
      .from("trip_participants")
      .delete()
      .eq("trip_id", group.id)
      .eq("auth_user_id", userId);
    transferred += 1;
  }
  return transferred;
}

export async function purgeAccount(admin: SupabaseClient, userId: string) {
  const storageObjectsRemoved = await removeAccountStorage(admin, userId);
  const sharedTripGroupsTransferred = await preserveSharedTripGroups(admin, userId);
  const deletedRows: Record<string, number> = {};

  for (const spec of DELETE_ORDER) {
    const { data, error } = await admin
      .from(spec.table)
      .delete()
      .eq(spec.column, userId)
      .select("id");
    if (error) throw new Error(`${spec.table}: ${error.message}`);
    deletedRows[spec.table] = (data || []).length;
  }

  // These references deliberately preserve shared history without retaining identity.
  await admin
    .from("trip_members")
    .update({ auth_user_id: null, email: null, name: "Utilisateur supprimé", is_me: false })
    .eq("auth_user_id", userId);
  await admin.from("asset_owners").update({ user_id: null }).eq("user_id", userId);
  await admin.from("trip_groups").update({ closed_by: null }).eq("closed_by", userId);

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) throw new Error(`auth.users: ${authError.message}`);

  return { storageObjectsRemoved, sharedTripGroupsTransferred, deletedRows };
}
