// Run via test-account-deletion-supabase.mjs, not on shared/staging projects.
import assert from 'node:assert/strict';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { purgeAccount } from '../supabase/functions/_shared/account-data.ts';
import { processAccountDeletions } from '../supabase/functions/process-account-deletions/processor.ts';

const [url, marker] = Deno.args;
assert.match(url, /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/);
assert.match(marker, /^[a-f0-9-]{36}$/);
const key = Deno.env.get('F13_LOCAL_SERVICE_KEY');
const anon = Deno.env.get('F13_LOCAL_ANON_KEY');
assert.ok(key && anon);
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
async function checked<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
let fixtureReady = false;
for (let attempt = 0; attempt < 20; attempt++) {
  const { data } = await admin.from('f13_fixture_guard').select('id').eq('id', marker).maybeSingle();
  if (data?.id === marker) { fixtureReady = true; break; }
  await new Promise(resolve => setTimeout(resolve, 250));
}
assert.equal(fixtureReady, true, 'Refusing to mutate any stack not created by the fixture');
const createUser = async (who: string) => {
  const email = `travelbudget-f13-${who}-${marker}@example.test`;
  const password = `synthetic-only-${crypto.randomUUID()}!`;
  const result = await checked(admin.auth.admin.createUser({ email, email_confirm: true, password }));
  assert.ok(result.user?.id);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  assert.equal((await checked(client.auth.signInWithPassword({ email, password }))).user?.id, result.user.id);
  return { id: result.user.id, client };
};
const { id: departing, client: departingClient } = await createUser('departing');
const { id: survivor, client: survivorClient } = await createUser('survivor');
const trip = crypto.randomUUID();
const expense = crypto.randomUUID();
const request = crypto.randomUUID();
const departingDocumentId = crypto.randomUUID();
const survivorDocumentId = crypto.randomUUID();
const personalPath = `${departing}/${departingDocumentId}/receipt.txt`;
const survivorPath = `${survivor}/${survivorDocumentId}/receipt.txt`;
const inboxPath = `whatsapp/${departing}/receipt.txt`;
const payload = new Blob(['Local F13 fixture only']);
for (const bucket of ['personal-documents', 'inbox-documents']) await checked(admin.storage.createBucket(bucket, { public: false }));
await checked(departingClient.storage.from('personal-documents').upload(personalPath, payload));
await checked(survivorClient.storage.from('personal-documents').upload(survivorPath, payload));
for (const [name, uid] of [[personalPath, departing], [survivorPath, survivor]]) {
  const object = await checked(admin.from('f13_fixture_object_owners').select('owner_id').eq('bucket_id', 'personal-documents').eq('name', name).single());
  assert.equal(object?.owner_id, uid, 'fixture upload must exercise real Storage ownership');
}
await checked(admin.storage.from('inbox-documents').upload(inboxPath, payload));
await checked(admin.storage.from('inbox-documents').upload(`whatsapp/${departing}/unreferenced.txt`, payload));
await checked(admin.from('documents').insert([
  { id: departingDocumentId, user_id: departing, storage_bucket: 'personal-documents', storage_path: personalPath },
  { id: survivorDocumentId, user_id: survivor, storage_bucket: 'personal-documents', storage_path: survivorPath },
]));
await checked(admin.from('inbox_items').insert({ id: crypto.randomUUID(), user_id: departing, storage_path: inboxPath }));
await checked(admin.from('assistant_request_quota').insert({ scope: departing, user_id: departing, quota_day: '2026-01-01', requests: 1 }));
await checked(admin.from('nutrition_foods').insert({ key: 'f13-fixture-food', user_id: departing, name: 'Fixture food' }));
await checked(admin.from('sport_exercise_favorites').insert({ user_id: departing, exercise_key: 'boxing_shadow' }));
await checked(admin.from('trip_groups').insert({ id: trip, user_id: departing }));
await checked(admin.from('trip_participants').insert([
  { id: crypto.randomUUID(), trip_id: trip, auth_user_id: departing },
  { id: crypto.randomUUID(), trip_id: trip, auth_user_id: survivor },
]));
await checked(admin.from('trip_expenses').insert({ id: expense, trip_id: trip, user_id: departing, amount: 42 }));
await checked(admin.from('account_deletion_requests').insert({ id: request, user_id: departing, execute_after: new Date(0).toISOString() }));

const result = await processAccountDeletions(admin, purgeAccount);
assert.equal(result.processed, 1);
const finished = await checked(admin.from('account_deletion_requests').select('status,user_id,data_purged_at').eq('id', request).single());
assert.equal(finished?.status, 'completed');
assert.equal(finished?.user_id, null);
const completed = result.results[0];
assert.equal(completed?.status, 'completed');
const deletedRows = (completed as { deletedRows?: Record<string, number> }).deletedRows;
assert.equal(deletedRows?.nutrition_foods, 1);
assert.equal(deletedRows?.sport_exercise_favorites, 1);
assert.equal(deletedRows?.assistant_request_quota, 1);
assert.ok(finished?.data_purged_at);
const { data: departedAuth, error: departedError } = await admin.auth.admin.getUserById(departing);
assert.ok(departedError, 'GoTrue must report the departing fixture account absent');
assert.equal(departedError.status, 404);
assert.equal(departedAuth.user, null);
assert.equal((await checked(admin.auth.admin.getUserById(survivor))).user?.id, survivor);
const departingFiles = await checked(admin.storage.from('personal-documents').list(`${departing}/${departingDocumentId}`));
const departingInbox = await checked(admin.storage.from('inbox-documents').list(`whatsapp/${departing}`));
assert.deepEqual(departingFiles, []);
assert.deepEqual(departingInbox, []);
assert.equal((await checked(admin.from('assistant_request_quota').select('scope').eq('scope', departing).maybeSingle())), null);
assert.equal(await (await checked(admin.storage.from('personal-documents').download(survivorPath)))?.text(), 'Local F13 fixture only');
assert.equal((await checked(admin.from('trip_groups').select('user_id').eq('id', trip).single()))?.user_id, survivor);
const retained = await checked(admin.from('trip_expenses').select('user_id,amount').eq('id', expense).single());
assert.equal(retained?.user_id, survivor);
assert.equal(retained?.amount, 42);
assert.equal((await processAccountDeletions(admin, purgeAccount)).processed, 0);
console.log('PASS real local Auth hard deletion, Storage purge + neighboring account untouched, real queue checkpoint, retained shared trip and no-op rerun');
