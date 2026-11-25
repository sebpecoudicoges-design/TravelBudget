// Isolated integration checks. No remote URL or user data.
// --rest exposes only PostgREST on a random IPv4 loopback port; never PostgreSQL.
// Requires Docker running; only the container created here is removed.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const docker = process.env.DOCKER_BIN || 'docker';
const image = 'postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929';
const name = `tb-f13-test-${randomUUID()}`;
const withRest = process.argv.includes('--rest');
let container;
let restContainer;
function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; if (args[0] === 'run') process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error || `Docker exit ${code}`)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
const args = () => ['exec', '-i', '-e', 'PGPASSWORD=synthetic-test-only', container, 'psql', '-h', '127.0.0.1', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
const sql = query => command(args(), `SET statement_timeout='15s';\n${query}`);
const table = 'public.account_deletion_requests';
const uid = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const old = '2026-11-23T22:00:00Z';
const current = '2026-11-24T00:00:00Z';
const claim = status => `UPDATE ${table} SET status='processing', processing_started_at='${current}', data_purged_at=NULL
  WHERE id='${id}' AND user_id='${uid}' AND status='${status}'
  ${status === 'processing' ? `AND processing_started_at='${old}'` : ''} RETURNING id;`;

async function contention(status, cancelFirst = false) {
  await sql(`UPDATE ${table} SET status='${status}', processing_started_at='${old}' WHERE id='${id}';`);
  // Keep transaction A open until B is observed waiting on its real row lock.
  const first = spawn(docker, args(), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; let errors = '';
  first.stdout.on('data', chunk => { output += chunk; });
  first.stderr.on('data', chunk => { errors += chunk; });
  const done = new Promise((resolve, reject) => {
    first.on('error', reject);
    first.on('close', code => code === 0 ? resolve() : reject(new Error(errors)));
  });
  // Attach a handler immediately, including on exceptional cleanup paths.
  done.catch(() => {});
  first.stdin.on('error', () => {});
  let second;
  try {
    const firstUpdate = cancelFirst
      ? `UPDATE ${table} SET status='cancelled' WHERE user_id='${uid}' AND status='pending' RETURNING id;`
      : claim(status);
    first.stdin.write(`SET idle_in_transaction_session_timeout='20s'; BEGIN; ${firstUpdate}\n\\echo CLAIM_HELD\n`);
    for (let i = 0; i < 100 && !output.includes('CLAIM_HELD'); i++) await delay(100);
    assert.ok(output.includes(id) && output.includes('CLAIM_HELD'), `First claim failed: ${errors}`);
    second = sql(`SET application_name='tb_f13_competitor'; ${claim(status)}`);
    second.catch(() => {});
    let blocked = false;
    for (let i = 0; i < 40; i++) {
      blocked = await sql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='tb_f13_competitor' AND wait_event_type='Lock');") === 't';
      if (blocked) break;
      await delay(100);
    }
    assert.ok(blocked, 'Second connection was not observed waiting on the row lock');
    first.stdin.end('COMMIT;\n');
    await done;
    assert.equal(await second, '', 'Second claimant must update zero rows after the first commits');
    assert.equal(await sql(`SELECT count(*) FROM ${table} WHERE id='${id}' AND status='${cancelFirst ? 'cancelled' : 'processing'}' AND processing_started_at='${cancelFirst ? old : current}';`), '1');
    console.log(cancelFirst ? 'PASS committed cancellation prevents waiting processor from claiming' : `PASS concurrent ${status} claims: real lock wait, one winner`);
  } finally {
    if (!first.stdin.writableEnded) first.stdin.end('ROLLBACK;\n');
    await Promise.allSettled([done, ...(second ? [second] : [])]);
  }
}

try {
  console.log(`Isolated SQL test container: ${name}`);
  container = await command(['run', '-d', ...withRest ? ['-p', '127.0.0.1::3000'] : ['--network', 'none'], '--name', name,
    '-e', 'POSTGRES_PASSWORD=synthetic-test-only', image]);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { await sql('SELECT 1;'); ready = true; break; } catch { await delay(500); }
  }
  assert.ok(ready, 'Isolated PostgreSQL did not become ready');
  await sql(`CREATE SCHEMA IF NOT EXISTS auth; CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY);
    DO $$ BEGIN
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;`);
  await sql(await readFile(new URL('../supabase/migrations/20260725234344_account_data_requests.sql', import.meta.url), 'utf8'));
  await sql(`INSERT INTO auth.users(id) VALUES('${uid}'); INSERT INTO ${table}(id,user_id) VALUES('${id}','${uid}');`);
  const migration = await readFile(new URL('../supabase/migrations/20261124090000_account_deletion_checkpoint.sql', import.meta.url), 'utf8');
  await sql(migration);
  await sql(migration);
  assert.equal(await sql(`SELECT data_purged_at IS NULL FROM ${table} WHERE id='${id}';`), 't');
  assert.equal(await sql(`SELECT relrowsecurity FROM pg_class WHERE oid='${table}'::regclass;`), 't');
  for (const role of ['anon', 'authenticated']) {
    assert.equal(await sql(`SELECT has_table_privilege('${role}','${table}','SELECT,INSERT,UPDATE,DELETE');`), 'f');
  }
  assert.equal(await sql(`SELECT has_column_privilege('service_role','${table}','data_purged_at','UPDATE');`), 't');
  console.log('PASS migration applied twice, no backfill, RLS and role privileges retained');
  await contention('pending', true);
  await contention('pending');
  await contention('processing');
  assert.equal(await sql(`UPDATE ${table} SET status='cancelled' WHERE user_id='${uid}' AND status='pending' RETURNING id;`), '');
  console.log('PASS cancellation cannot acknowledge an already processing request');
  assert.equal(await sql(`UPDATE ${table} SET status='completed' WHERE id='${id}' AND status='processing' AND processing_started_at='${old}' RETURNING id;`), '');
  console.log('PASS stale owner cannot acknowledge completion');
  await sql(`UPDATE ${table} SET data_purged_at='${current}' WHERE id='${id}'; DELETE FROM auth.users WHERE id='${uid}';`);
  assert.equal(await sql(`SELECT user_id IS NULL AND data_purged_at IS NOT NULL FROM ${table} WHERE id='${id}';`), 't');
  assert.equal(await sql(`SELECT id FROM ${table} WHERE status='processing' AND processing_started_at<'2026-11-24T00:30:00Z' AND user_id IS NULL AND data_purged_at IS NOT NULL;`), id);
  console.log('PASS Auth foreign key clears user reference and preserves reconciliation checkpoint');
  if (withRest) {
    await sql(`DELETE FROM ${table} WHERE id='${id}';
      INSERT INTO auth.users(id) SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid FROM generate_series(10,21) AS i;`);
    // Deliberately minimal fixture schema for purge sequencing, NOT a replica
    // of production constraints/RLS. Names come only from the local allow-list.
    const accountSource = await readFile(new URL('../supabase/functions/_shared/account-data.ts', import.meta.url), 'utf8');
    const fixtureTables = [...new Set([...accountSource.matchAll(/\{ table: "([a-z_]+)", column:/g)].map(match => match[1]))];
    assert.ok(fixtureTables.includes('trip_groups') && fixtureTables.includes('documents'));
    await sql(fixtureTables.map(tableName => `CREATE TABLE public.${tableName} (
      id uuid PRIMARY KEY, user_id uuid, created_by uuid, auth_user_id uuid,
      trip_id uuid, expense_id uuid, member_id uuid, transaction_id uuid, closed_by uuid, created_at timestamptz DEFAULT now(),
      email text, name text, is_me boolean, amount numeric, storage_bucket text, storage_path text);
      ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.${tableName} TO service_role;`).join('\n'));
    // Execute the repository's actual budget-link guard, not a test imitation.
    const integrityMigration = await readFile(new URL('../supabase/migrations/20260606084112_harden_trip_budget_links_and_delete.sql', import.meta.url), 'utf8');
    const guard = integrityMigration.split('revoke execute on function public.trip_validate_budget_link_integrity()')[0];
    assert.ok(guard.includes('create trigger trip_expense_budget_links_integrity_guard'));
    await sql(guard);
    restContainer = await command(['run', '-d', '--name', `${name}-rest`, '--network', `container:${container}`,
      '-e', 'PGRST_DB_URI=postgres://postgres:synthetic-test-only@127.0.0.1:5432/postgres',
      '-e', 'PGRST_DB_ANON_ROLE=service_role', '-e', 'PGRST_DB_SCHEMAS=public',
      'public.ecr.aws/supabase/postgrest@sha256:488093de819567422bc1d37cb79da6e84bca3726bac321daeed618f0ed957888']);
    const address = await command(['port', container, '3000/tcp']);
    assert.match(address, /^127\.0\.0\.1:\d+$/);
    const endpoint = `http://${address}`;
    let restReady = false;
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(`${endpoint}/account_deletion_requests?limit=0`, { signal: AbortSignal.timeout(1000) })).ok) { restReady = true; break; } } catch { /* starting */ }
      await delay(250);
    }
    assert.ok(restReady, 'Isolated PostgREST did not become ready');
    const localPath = path => fileURLToPath(new URL(path, import.meta.url));
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [localPath('../node_modules/deno/bin.cjs'), 'run', '--no-config',
        `--lock=${localPath('../config/edge-check.lock')}`, '--frozen=true', '--allow-env', `--allow-net=${address}`,
        localPath('./check-account-deletion-rest.ts'), endpoint], { windowsHide: true, stdio: 'inherit' });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`PostgREST integration exit ${code}`)));
    });
  }
  console.log(`Checks passed (${withRest ? 'SQL + real processor/PostgREST' : 'SQL only'}). Auth API and Storage purge remain unvalidated.`);
} catch (error) {
  if (container) console.error(await command(['logs', '--tail', '30', container]).catch(() => 'Container logs unavailable'));
  throw error;
} finally {
  if (restContainer) await command(['rm', '-f', '-v', restContainer]);
  if (container) {
    await command(['rm', '-f', '-v', container]).catch(error => {
      throw new Error(`Cleanup not confirmed for ${name} (${container}): ${error.message}`);
    });
    console.log('Isolated test container and its anonymous volumes removed.');
  }
}
