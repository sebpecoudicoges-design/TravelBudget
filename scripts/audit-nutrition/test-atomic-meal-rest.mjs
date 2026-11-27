// Strictly local: a fresh database, a synthetic signed identity and local PostgREST.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { atomicMealRpc, replayAtomicMeal } from './atomic-meal-client.mjs';
import { loadNutritionAuditFixture, userA } from './fixture.mjs';
import { localPort, startNutritionAuditPostgres } from './local-postgres.mjs';

const [pgBin, driverPath, postgrestBin] = process.argv.slice(2);
if (!pgBin || !driverPath || !postgrestBin) {
  throw new Error('Usage: node test-atomic-meal-rest.mjs PG_BIN_DIR PG_NODE_MODULE POSTGREST_BIN');
}
const db = await startNutritionAuditPostgres(pgBin, driverPath);
const password = randomBytes(24).toString('hex');
const jwtSecret = randomBytes(32).toString('hex');
const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const signingInput = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({
  role: 'authenticated', sub: userA, exp: Math.floor(Date.now() / 1000) + 120,
});
const token = signingInput + '.' + createHmac('sha256', jwtSecret).update(signingInput).digest('base64url');
const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
const row = {
  syncId: 'http-response-lost',
  meal: {
    user_id: userA, travel_id: null, meal_date: '2026-11-27', meal_type: 'dinner',
    label: 'Synthetic dinner', water_ml: 150, consumed_time: '18:15',
  },
  items: [
    { food_key: 'rice_cooked', label: 'Synthetic rice', grams: 80 },
    { food_key: 'pasta_cooked', label: 'Synthetic pasta', grams: 120 },
  ],
};
let rest, proxy;
let restLog = '';
const request = (url, body) => fetch(url, {
  method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
});
const json = async response => {
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return body;
};
try {
  const admin = await db.connect();
  await loadNutritionAuditFixture({ exec: sql => admin.query(sql), query: (...args) => admin.query(...args) });
  // Password is freshly generated hex, never inherited from another environment.
  await admin.query(`create role audit_authenticator login noinherit password '${password}';
    grant authenticated, anon to audit_authenticator;`);

  const restPort = await localPort();
  const origin = `http://127.0.0.1:${restPort}`;
  const url = origin + '/rpc/' + atomicMealRpc;
  const replay = (endpoint, snapshot = row, isCurrent = () => true) => replayAtomicMeal({
    userId: userA, row: snapshot, isCurrent,
    transport: {
      userId: userA,
      async rpc(name, args) {
        assert.equal(name, atomicMealRpc);
        const response = await request(endpoint, args);
        const value = await response.json();
        return response.ok ? { data: value } : { error: value };
      },
    },
  });
  rest = spawn(resolve(postgrestBin), [], {
    env: {
      PATH: process.env.PATH, LC_ALL: 'C',
      PGRST_DB_URI: `postgresql://audit_authenticator:${password}@127.0.0.1:${db.port}/postgres`,
      PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: jwtSecret,
      PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(restPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  rest.on('error', error => { restLog += error.message; });
  rest.stdout.on('data', value => { restLog = (restLog + value).slice(-3000); });
  rest.stderr.on('data', value => { restLog = (restLog + value).slice(-3000); });
  let ready = false;
  for (let attempt = 0; attempt < 80 && rest.exitCode === null; attempt += 1) {
    const response = await fetch(origin, { signal: AbortSignal.timeout(300) }).catch(() => null);
    if (response) {
      ready = response.ok;
      await response.body?.cancel();
      if (ready) break;
    }
    await delay(50);
  }
  assert.equal(ready, true, 'PostgREST failed to start: ' + restLog);

  let firstPayload;
  let resolveForwarded;
  const forwarded = new Promise(resolve => { resolveForwarded = resolve; });
  // The local proxy waits for the first upstream response, then drops only the
  // downstream response socket. This is a real fetch transport error to the caller.
  proxy = createServer(async (incoming, outgoing) => {
    try {
      const parts = [];
      for await (const chunk of incoming) parts.push(chunk);
      const payload = JSON.parse(Buffer.concat(parts).toString('utf8'));
      firstPayload = payload;
      resolveForwarded({ value: await json(await request(url, payload)) });
    } catch (error) {
      resolveForwarded({ error });
    } finally {
      outgoing.destroy();
    }
  });
  await new Promise((done, reject) => proxy.once('error', reject).listen(0, '127.0.0.1', done));
  await assert.rejects(replay(`http://127.0.0.1:${proxy.address().port}`), { name: 'TypeError' });
  const original = await forwarded;
  if (original.error) throw original.error;
  const [created] = original.value;
  assert.equal(created.status, 'created');

  const counts = async () => (await admin.query(`select count(distinct m.id)::int as meals,
    count(i.id)::int as items from public.nutrition_meals m
    left join public.nutrition_meal_items i on i.meal_id = m.id where m.user_id = $1`, [userA])).rows[0];
  assert.deepEqual(await counts(), { meals: 1, items: 2 }, 'first request committed despite dropped response');
  assert.deepEqual(await replay(url), {
    mealId: created.meal_id, status: 'already_applied', disposition: 'confirmed',
  });
  const edited = { ...row, items: [{ ...row.items[0], grams: 81 }, row.items[1]] };
  assert.deepEqual(await replay(url, edited), {
    mealId: created.meal_id, status: 'conflict', disposition: 'pending',
  });
  const invalid = await request(url, {
    ...firstPayload, p_sync_id: 'invalid-item',
    p_items: [firstPayload.p_items[0], { ...firstPayload.p_items[1], grams: -1 }],
  });
  assert.equal(invalid.ok, false);
  assert.equal((await invalid.json()).code, '23514');
  assert.deepEqual(await counts(), { meals: 1, items: 2 });
  assert.deepEqual((await admin.query('select grams::int from public.nutrition_meal_items where meal_id=$1 order by sort_order', [created.meal_id])).rows,
    [{ grams: 80 }, { grams: 120 }]);
  console.log('PostgREST and audit client: lost response, confirmed identical retry, pending conflict and rollback verified.');
} finally {
  if (proxy) {
    proxy.closeAllConnections();
    await new Promise(resolve => proxy.close(resolve));
  }
  if (rest && rest.exitCode === null && rest.pid) {
    const closed = new Promise(resolve => rest.once('exit', resolve));
    rest.kill('SIGTERM');
    const ended = await Promise.race([closed.then(() => true), delay(2000).then(() => false)]);
    if (!ended) { rest.kill('SIGKILL'); await closed; }
  }
  await db.close();
}
