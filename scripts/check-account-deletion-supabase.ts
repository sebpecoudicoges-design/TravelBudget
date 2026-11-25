// Run via test-account-deletion-supabase.mjs, not on shared/staging projects.
import assert from 'node:assert/strict';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { purgeAccount } from '../supabase/functions/_shared/account-data.ts';
import { DELETION_RECLAIM_MS, processAccountDeletions } from '../supabase/functions/process-account-deletions/processor.ts';

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
const departedPayment = crypto.randomUUID();
const survivorExpense = crypto.randomUUID();
const survivorPayment = crypto.randomUUID();
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
await checked(admin.from('transactions').insert([
  { id: departedPayment, user_id: departing, amount: 42 },
  { id: survivorPayment, user_id: survivor, amount: 17 },
]));
await checked(admin.from('trip_expenses').insert([
  { id: expense, trip_id: trip, user_id: departing, amount: 42, transaction_id: departedPayment },
  { id: survivorExpense, trip_id: trip, user_id: survivor, amount: 17, transaction_id: survivorPayment },
]));
await checked(admin.from('account_deletion_requests').insert({ id: request, user_id: departing, execute_after: new Date(0).toISOString() }));

// Two legitimate scheduled invocations race for the same due request.
const workerAt = new Date();
let purgeStarts = 0;
const race = await Promise.all([1, 2].map(() => processAccountDeletions(admin,
  async (client, userId, checkpoint) => {
    purgeStarts += 1;
    assert.equal(userId, departing);
    return await purgeAccount(client, userId, checkpoint);
  }, () => workerAt)));
assert.equal(purgeStarts, 1);
assert.deepEqual(race.map(item => item.processed).sort(), [0, 1]);
const result = race.find(item => item.processed === 1)!;
const finished = await checked(admin.from('account_deletion_requests').select('status,user_id,data_purged_at').eq('id', request).single());
assert.equal(finished?.status, 'completed');
assert.equal(finished?.user_id, null);
const completed = result.results[0];
assert.equal(completed?.status, 'completed');
const deletedRows = (completed as { deletedRows?: Record<string, number> }).deletedRows;
assert.equal(deletedRows?.nutrition_foods, 1);
assert.equal(deletedRows?.sport_exercise_favorites, 1);
assert.equal(deletedRows?.assistant_request_quota, 1);
assert.equal(deletedRows?.transactions, 1);
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
const retained = await checked(admin.from('trip_expenses').select('user_id,amount,transaction_id').eq('id', expense).single());
assert.equal(retained?.user_id, survivor);
assert.equal(retained?.amount, 42);
assert.equal(retained?.transaction_id, null);
assert.equal((await checked(admin.from('transactions').select('id').eq('id', departedPayment).maybeSingle())), null);
assert.equal((await checked(admin.from('trip_expenses').select('transaction_id').eq('id', survivorExpense).single()))?.transaction_id, survivorPayment);
assert.equal((await checked(admin.from('transactions').select('user_id').eq('id', survivorPayment).single()))?.user_id, survivor);
assert.equal((await processAccountDeletions(admin, purgeAccount)).processed, 0);
console.log('PASS real local Auth hard deletion, Storage purge + neighboring account untouched, real queue checkpoint, retained shared trip and no-op rerun');


async function scheduleFixtureDeletion(userId: string) {
  const id = crypto.randomUUID();
  await checked(admin.from('account_deletion_requests').insert({ id, user_id: userId, execute_after: new Date(0).toISOString() }));
  return id;
}
async function requestState(id: string) {
  return await checked(admin.from('account_deletion_requests')
    .select('status,user_id,attempt_count,processing_started_at,data_purged_at').eq('id', id).single());
}
const initialClock = new Date();
const notExpired = () => new Date(initialClock.getTime() + DELETION_RECLAIM_MS - 1000);
const expired = () => new Date(initialClock.getTime() + DELETION_RECLAIM_MS + 1000);

// Only the local fixture transport is instrumented. Supabase services keep
// running. One genuine Storage operation is temporarily unavailable *to this
// worker*; other calls, including retry, reach the actual local services.
const { id: retryUser, client: retryUserClient } = await createUser('storage-retry');
const retryPersonal = `${retryUser}/${crypto.randomUUID()}/receipt.txt`;
const retryInbox = `whatsapp/${retryUser}/receipt.txt`;
await checked(retryUserClient.storage.from('personal-documents').upload(retryPersonal, payload));
await checked(admin.storage.from('inbox-documents').upload(retryInbox, payload));
const retryId = await scheduleFixtureDeletion(retryUser);
let incidentRequests = 0;
const degradedWorker = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => {
    const destination = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : undefined);
    if (destination.origin === url && destination.pathname === '/storage/v1/object/inbox-documents' && method === 'DELETE') {
      incidentRequests += 1;
      return Promise.resolve(new Response(JSON.stringify({ message: 'fixture temporary Storage outage', statusCode: '503' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }));
    }
    return fetch(input, init);
  } },
});
const pending = await processAccountDeletions(degradedWorker, purgeAccount, () => initialClock);
assert.ok(incidentRequests > 0);
assert.equal(pending.results[0]?.status, 'processing');
const duringRetry = await requestState(retryId);
assert.equal(duringRetry?.attempt_count, 1);
assert.equal(Date.parse(duringRetry?.processing_started_at ?? ''), initialClock.getTime());
assert.equal(duringRetry?.data_purged_at, null);
assert.equal((await checked(admin.auth.admin.getUserById(retryUser))).user?.id, retryUser);
assert.deepEqual(await checked(admin.storage.from('personal-documents').list(retryUser)), []);
assert.equal(await (await checked(admin.storage.from('inbox-documents').download(retryInbox)))?.text(), 'Local F13 fixture only');
assert.equal((await processAccountDeletions(admin, purgeAccount, notExpired)).processed, 0);
assert.equal((await requestState(retryId))?.processing_started_at, duringRetry?.processing_started_at);
assert.equal((await processAccountDeletions(admin, purgeAccount, expired)).results[0]?.status, 'completed');
assert.equal((await requestState(retryId))?.attempt_count, 2);
assert.ok((await requestState(retryId))?.data_purged_at);
assert.equal((await admin.auth.admin.getUserById(retryUser)).error?.status, 404);
assert.deepEqual(await checked(admin.storage.from('inbox-documents').list(`whatsapp/${retryUser}`)), []);
console.log('PASS real local queue/Storage/Auth after benign transport outage: partial cleanup resumes only after lease expiry');

// The underlying cleanup and Auth deletion execute normally. The fixture
// interrupts only the hand-off back to the worker before it writes completion.
const { id: interruptedUser } = await createUser('bookkeeping-interrupted');
const interruptedId = await scheduleFixtureDeletion(interruptedUser);
await assert.rejects(processAccountDeletions(admin, async (client, userId, checkpoint) => {
  assert.equal(userId, interruptedUser);
  await purgeAccount(client, userId, checkpoint);
  throw new Error('fixture interruption after Auth acknowledgement');
}, () => initialClock), /fixture interruption after Auth acknowledgement/);
const interrupted = await requestState(interruptedId);
assert.equal(interrupted?.status, 'processing');
assert.equal(interrupted?.user_id, null, 'real Auth FK must already clear the account reference');
assert.equal(interrupted?.attempt_count, 1);
assert.ok(interrupted?.data_purged_at);
assert.equal((await admin.auth.admin.getUserById(interruptedUser)).error?.status, 404);
let repeats = 0;
const repeatPurge: typeof purgeAccount = (...args) => { repeats += 1; return purgeAccount(...args); };
assert.equal((await processAccountDeletions(admin, repeatPurge, notExpired)).processed, 0);
assert.deepEqual((await processAccountDeletions(admin, repeatPurge, expired)).results, [
  { id: interruptedId, status: 'completed', reconciled: true },
]);
assert.equal(repeats, 0);
assert.equal((await requestState(interruptedId))?.attempt_count, 1);
assert.equal((await processAccountDeletions(admin, repeatPurge, expired)).processed, 0);
console.log('PASS completed real Auth deletion reconciles after interrupted bookkeeping without a second purge');
