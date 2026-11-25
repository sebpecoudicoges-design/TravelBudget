// Invoked only by the isolated Docker harness; no production credentials.
import assert from "node:assert/strict";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { processAccountDeletions } from "../supabase/functions/process-account-deletions/processor.ts";
import { purgeAccount } from "../supabase/functions/_shared/account-data.ts";

const endpoint = Deno.args[0];
assert.match(endpoint, /^http:\/\/127\.0\.0\.1:\d+$/);
function localFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  // This isolated server uses service_role as its test-only anonymous role.
  headers.delete("Authorization");
  return fetch(String(input).replace("/rest/v1/", "/"), { ...init, headers });
}
const admin = createClient(endpoint, "isolated-test-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: localFetch },
});
const table = "account_deletion_requests";
const at = () => new Date("2026-11-24T00:00:00Z");
const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const row = (index: number, patch: Record<string, unknown> = {}) => ({
  id: uuid(index + 100), user_id: uuid(index), status: "pending",
  execute_after: "2026-11-23T00:00:00Z", ...patch,
});
async function checked(query: PromiseLike<{ data: unknown; error: unknown }>) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}
await checked(admin.from(table).insert([
  row(10), row(11, { status: "processing", processing_started_at: "2026-11-23T22:00:00Z" }),
  row(12, { status: "processing", processing_started_at: "2026-11-23T23:59:00Z" }),
  row(13, { status: "processing" }), row(14, { status: "cancelled" }), row(15, { status: "failed" }),
  row(16, { execute_after: "2026-11-25T00:00:00Z" }),
  row(17, { user_id: null, status: "processing", processing_started_at: "2026-11-23T22:00:00Z", data_purged_at: "2026-11-23T22:01:00Z" }),
  row(18, { user_id: null, status: "processing", processing_started_at: "2026-11-23T22:00:00Z" }),
]));
const purged: string[] = [];
const result = await processAccountDeletions(admin, async (_client, userId, checkpoint) => {
  purged.push(userId);
  await checkpoint();
  return {};
}, at);
assert.equal(result.processed, 3);
assert.deepEqual(purged.sort(), [uuid(10), uuid(11)]);
assert.ok(result.results.some(item => item.id === uuid(117) && item.reconciled));
const excluded = await checked(admin.from(table).select("id,status").in("id", [112, 113, 114, 115, 116, 118].map(uuid))) as Array<{ id: string; status: string }>;
assert.deepEqual(excluded.map(item => item.status).sort(), ["processing", "processing", "cancelled", "failed", "pending", "processing"].sort());
console.log("PASS real processor + pinned SDK + PostgREST: due/stale/checkpoint selection and excluded rows");

await checked(admin.from(table).insert(row(19)));
let calls = 0;
const purge = async (_client: unknown, _userId: string, checkpoint: () => Promise<void>) => {
  calls += 1; await checkpoint(); return {};
};
const attempts = await Promise.all([processAccountDeletions(admin, purge, at), processAccountDeletions(admin, purge, at)]);
assert.equal(calls, 1);
assert.equal(attempts.reduce((total, item) => total + item.processed, 0), 1);
console.log("PASS concurrent processors over HTTP: one purge invocation");

await checked(admin.from(table).insert(row(20)));
// Fail only final completion, after checkpoint and simulated Auth disappearance.
const completionFailure = createClient(endpoint, "isolated-test-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => {
    if (init?.method === "PATCH" && JSON.parse(String(init.body)).status === "completed") {
      return Promise.resolve(new Response(JSON.stringify({ message: "injected completion failure" }), { status: 500, headers: { "Content-Type": "application/json" } }));
    }
    return localFetch(input, init);
  } },
});
await assert.rejects(() => processAccountDeletions(completionFailure, async (_client, userId, checkpoint) => {
  await checkpoint();
  await checked(admin.from(table).update({ user_id: null }).eq("user_id", userId));
  return {};
}, at));
// Keep the active request excluded during this recovery; advancing by 31 minutes
// would also legitimately make its original 23:59 timestamp reclaimable.
await checked(admin.from(table).update({ processing_started_at: "2026-11-24T00:59:00Z" }).eq("id", uuid(112)));
const recovered = await processAccountDeletions(admin, async () => { throw new Error("Reconciliation must not purge again"); }, () => new Date("2026-11-24T01:00:00Z"));
assert.deepEqual(recovered.results, [{ id: uuid(120), status: "completed", reconciled: true }]);
console.log("PASS persisted checkpoint survives failed completion and reconciles via HTTP without repeat purge");

// Exercise the real purge with persisted fixture rows. Auth/Storage remain
// explicit fakes; production foreign keys/triggers are NOT represented here.
const departing = uuid(30), successor = uuid(31), trip = uuid(300);
await checked(admin.from("trip_groups").insert({ id: trip, user_id: departing, closed_by: departing }));
await checked(admin.from("trip_participants").insert([
  { id: uuid(301), trip_id: trip, auth_user_id: departing },
  { id: uuid(302), trip_id: trip, auth_user_id: successor },
]));
await checked(admin.from("trip_members").insert({ id: uuid(303), trip_id: trip, user_id: departing, auth_user_id: departing, email: "synthetic@example.invalid", name: "Synthetic", is_me: true }));
await checked(admin.from("trip_expenses").insert([
  { id: uuid(304), trip_id: trip, user_id: departing, amount: 42 },
  { id: uuid(305), trip_id: trip, user_id: successor, amount: 17 },
]));
await checked(admin.from("trip_expense_shares").insert({ id: uuid(306), trip_id: trip, user_id: departing, amount: 21 }));
await checked(admin.from("documents").insert({ id: uuid(307), user_id: departing, storage_bucket: "personal-documents", storage_path: `${departing}/${uuid(307)}/file.pdf` }));
await checked(admin.from("trip_members").insert({ id: uuid(308), trip_id: trip, user_id: successor, auth_user_id: successor }));
await checked(admin.from("transactions").insert([
  { id: uuid(309), user_id: departing, amount: 21 }, { id: uuid(310), user_id: successor, amount: 21 },
]));
await checked(admin.from("trip_expense_budget_links").insert([
  { id: uuid(311), trip_id: trip, expense_id: uuid(304), member_id: uuid(303), transaction_id: uuid(309), user_id: departing },
  { id: uuid(312), trip_id: trip, expense_id: uuid(304), member_id: uuid(308), transaction_id: uuid(310), user_id: successor },
]));
let authCalls = 0, checkpointCalls = 0, storageFails = true, transferFails = false, discoveryFails = false;
const purgeRest = createClient(endpoint, "isolated-test-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => {
    const requestUrl = new URL(String(input));
    if (discoveryFails && requestUrl.pathname.endsWith('/trip_groups') && requestUrl.searchParams.get('id')?.startsWith('in.')) {
      return Promise.resolve(new Response(JSON.stringify({ message: "injected discovery failure" }), { status: 500, headers: { "Content-Type": "application/json" } }));
    }
    if (transferFails && String(input).includes("/trip_expenses?") && init?.method === "PATCH") {
      return Promise.resolve(new Response(JSON.stringify({ message: "injected transfer failure" }), { status: 500, headers: { "Content-Type": "application/json" } }));
    }
    return localFetch(input, init);
  } },
});
const purgeClient = {
  from: purgeRest.from.bind(purgeRest),
  storage: { from: () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ error: storageFails ? { message: "injected Storage failure" } : null }) }) },
  auth: { admin: { deleteUser: async () => { authCalls++; assert.equal(checkpointCalls, 1); return { error: null }; } } },
} as unknown as typeof admin;
const checkpoint = async () => { checkpointCalls++; };
const readRows = async (tableName: string) => await checked(admin.from(tableName).select("*").order("id")) as Array<Record<string, unknown>>;
await assert.rejects(() => purgeAccount(purgeClient, departing, checkpoint), /injected Storage failure/);
assert.equal((await readRows("trip_groups"))[0].user_id, departing);
assert.equal(authCalls, 0); assert.equal(checkpointCalls, 0);
storageFails = false; transferFails = true;
await assert.rejects(() => purgeAccount(purgeClient, departing, checkpoint), /injected transfer failure/);
assert.equal((await readRows("trip_expense_shares"))[0].user_id, successor);
assert.equal((await readRows("trip_expenses"))[0].user_id, departing);
assert.equal((await readRows("trip_groups"))[0].user_id, departing);
assert.equal(authCalls, 0); assert.equal(checkpointCalls, 0);
transferFails = false;
await purgeAccount(purgeClient, departing, checkpoint);
assert.equal(authCalls, 1);
const groups = await readRows("trip_groups");
assert.equal(groups[0].user_id, successor); assert.equal(groups[0].closed_by, null);
assert.deepEqual((await readRows("trip_expenses")).map(item => [item.user_id, item.amount]), [[successor, 42], [successor, 17]]);
assert.deepEqual((await readRows("trip_expense_shares")).map(item => [item.user_id, item.amount]), [[successor, 21]]);
const members = await readRows("trip_members");
assert.equal(members[0].auth_user_id, null); assert.equal(members[0].email, null);
assert.equal(members[0].name, "Utilisateur supprimé");
assert.deepEqual((await readRows("trip_participants")).map(item => item.auth_user_id), [successor]);
assert.deepEqual(await readRows("documents"), []);
assert.deepEqual((await readRows("trip_expense_budget_links")).map(item => [item.id, item.user_id, item.transaction_id]), [[uuid(312), successor, uuid(310)]]);
assert.deepEqual((await readRows("transactions")).map(item => [item.id, item.user_id, item.amount]), [[uuid(310), successor, 21]]);
console.log("PASS real purge via PostgREST: Storage failure stops work, interrupted Trip transfer resumes without losing shared amounts; Auth fake called last");
console.log("PASS real budget-link trigger: departing personal link removed, successor link/transaction preserved");

// The departing user contributes to a Trip owned by someone else, even after
// their participant row has disappeared. Ownership of the Trip must not change.
const contributor = uuid(40), owner = uuid(41), foreignTrip = uuid(400);
await checked(admin.from("trip_groups").insert({ id: foreignTrip, user_id: owner }));
await checked(admin.from("trip_members").insert({ id: uuid(401), trip_id: foreignTrip, user_id: contributor, auth_user_id: contributor, email: "contributor@example.invalid", name: "Contributor" }));
await checked(admin.from("trip_expenses").insert({ id: uuid(402), trip_id: foreignTrip, user_id: contributor, amount: 53 }));
await checked(admin.from("trip_expense_shares").insert({ id: uuid(403), trip_id: foreignTrip, user_id: contributor, amount: 26.5 }));
await checked(admin.from("trip_settlements").insert({ id: uuid(404), trip_id: foreignTrip, user_id: contributor, amount: 12 }));
checkpointCalls = 0;
const authBeforeDiscovery = authCalls;
discoveryFails = true;
await assert.rejects(() => purgeAccount(purgeClient, contributor, checkpoint), /injected discovery failure/);
assert.equal(authCalls, authBeforeDiscovery); assert.equal(checkpointCalls, 0);
assert.equal((await readRows("trip_expenses")).find(item => item.id === uuid(402))?.user_id, contributor);
assert.equal((await readRows("trip_members")).find(item => item.id === uuid(401))?.auth_user_id, contributor);
discoveryFails = false;
const contributorResult = await purgeAccount(purgeClient, contributor, checkpoint);
assert.equal(contributorResult.sharedTripGroupsTransferred, 0);
assert.deepEqual((await readRows("trip_groups")).filter(item => item.id === foreignTrip).map(item => item.user_id), [owner]);
assert.deepEqual((await readRows("trip_expenses")).filter(item => item.id === uuid(402)).map(item => [item.user_id, item.amount]), [[owner, 53]]);
assert.deepEqual((await readRows("trip_expense_shares")).filter(item => item.id === uuid(403)).map(item => [item.user_id, item.amount]), [[owner, 26.5]]);
assert.deepEqual((await readRows("trip_settlements")).filter(item => item.id === uuid(404)).map(item => [item.user_id, item.amount]), [[owner, 12]]);
const contributorMember = (await readRows("trip_members")).find(item => item.id === uuid(401));
assert.equal(contributorMember?.auth_user_id, null); assert.equal(contributorMember?.email, null);
console.log("PASS contributor purge preserves shared Trip history under existing owner without requiring a participant row");
console.log("PASS failed group discovery stops before deleting shared rows, checkpoint or Auth");

// No remaining authenticated member: private Trip rows follow normal deletion.
const solo = uuid(50), soloTrip = uuid(500);
await checked(admin.from("trip_groups").insert({ id: soloTrip, user_id: solo }));
await checked(admin.from("trip_members").insert({ id: uuid(501), trip_id: soloTrip, user_id: solo, auth_user_id: null, name: "Guest" }));
await checked(admin.from("trip_expenses").insert({ id: uuid(502), trip_id: soloTrip, user_id: solo, amount: 9 }));
const unrelatedExpenses = await readRows("trip_expenses");
checkpointCalls = 0;
const soloResult = await purgeAccount(purgeClient, solo, checkpoint);
assert.equal(soloResult.sharedTripGroupsTransferred, 0);
assert.equal((await readRows("trip_groups")).some(item => item.id === soloTrip), false);
assert.equal((await readRows("trip_members")).some(item => item.id === uuid(501)), false);
assert.deepEqual(await readRows("trip_expenses"), unrelatedExpenses.filter(item => item.id !== uuid(502)));
console.log("PASS no authenticated successor: private Trip deleted, unrelated shared expenses intact");

// No participant rows, but an authenticated member can still receive the group.
const fallbackUser = uuid(60), fallbackOwner = uuid(61), fallbackTrip = uuid(600);
await checked(admin.from("trip_groups").insert({ id: fallbackTrip, user_id: fallbackUser }));
await checked(admin.from("trip_members").insert({ id: uuid(601), trip_id: fallbackTrip, user_id: fallbackUser, auth_user_id: fallbackOwner }));
await checked(admin.from("trip_expenses").insert({ id: uuid(602), trip_id: fallbackTrip, user_id: fallbackUser, amount: 18 }));
checkpointCalls = 0;
const fallbackResult = await purgeAccount(purgeClient, fallbackUser, checkpoint);
assert.equal(fallbackResult.sharedTripGroupsTransferred, 1);
assert.equal((await readRows("trip_groups")).find(item => item.id === fallbackTrip)?.user_id, fallbackOwner);
assert.equal((await readRows("trip_members")).find(item => item.id === uuid(601))?.auth_user_id, fallbackOwner);
assert.deepEqual((await readRows("trip_expenses")).filter(item => item.id === uuid(602)).map(item => [item.user_id, item.amount]), [[fallbackOwner, 18]]);
console.log("PASS authenticated member fallback preserves Trip without a participant row");

await checked(admin.from(table).insert(row(21)));
await assert.rejects(() => processAccountDeletions(admin, async (_client, userId, checkpoint) => {
  await checkpoint();
  await checked(admin.from(table).update({ user_id: null }).eq("user_id", userId));
  throw new Error("Auth response lost after deletion");
}, at), /Auth response lost/);
const ambiguous = await checked(admin.from(table).select("status,user_id,data_purged_at,failure_reason").eq("id", uuid(121)).single()) as Record<string, unknown>;
assert.equal(ambiguous.status, "processing"); assert.equal(ambiguous.user_id, null);
assert.ok(ambiguous.data_purged_at); assert.equal(ambiguous.failure_reason, "Auth response lost after deletion");
const reconciled = await processAccountDeletions(admin, async () => { throw new Error("Must not repeat purge after Auth disappeared"); }, () => new Date("2026-11-24T01:00:00Z"));
assert.deepEqual(reconciled.results, [{ id: uuid(121), status: "completed", reconciled: true }]);
console.log("PASS lost Auth response after checkpoint remains processing and reconciles later without repeating purge");
