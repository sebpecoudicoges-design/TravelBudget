// Real Auth, Storage and PostgREST; disposable local Supabase, never linked.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = path => join(root, path);
const cli = process.env.SUPABASE_BIN || 'supabase';
const docker = process.env.DOCKER_BIN || 'docker';
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
  if (/^(SUPABASE_|PG|DB_URL|DATABASE_URL|DOCKER_HOST$|DOCKER_CONTEXT$)/i.test(key)) delete cleanEnv[key];
}
function command(executable, args, { input = '', redact = false, env = cleanEnv, cwd = root } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdin.on('error', () => {});
    child.on('error', error => reject(new Error(`${executable}: ${error.code || error.message}`)));
    child.on('close', code => code === 0 ? resolve(stdout.trim()) :
      reject(new Error(`${executable} ${args[0]} exited ${code}${redact ? '' : `: ${stderr.trim().slice(-3000)}`}`)));
    child.stdin.end(input);
  });
}
function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const context = await command(docker, ['context', 'show']);
const dockerEndpoint = await command(docker, ['context', 'inspect', context, '--format', '{{.Endpoints.docker.Host}}']);
assert.match(dockerEndpoint, /^(unix:\/\/\/[^\s]+|npipe:\/\/\/\/\.\/pipe\/[^\s]+)$/, 'A local Docker socket is required');
cleanEnv.DOCKER_CONTEXT = context;
await command(docker, ['info', '--format', '{{.ServerVersion}}']);
console.log(`Local Supabase CLI: ${await command(cli, ['--version'])}`);
const work = await mkdtemp(join(tmpdir(), 'travelbudget-f13-'));
const project = `tb-f13-${randomUUID().slice(0, 12)}`;
const marker = randomUUID();
const service = (...args) => command(cli, [...args, '--workdir', work], { cwd: work, redact: args[0] === 'status' });
let started = false;
let testFailure;
try {
  const ports = await Promise.all([reservePort(), reservePort(), reservePort()]);
  const [api, db, shadow] = ports.map(server => server.address().port);
  await Promise.all(ports.map(server => new Promise(resolve => server.close(resolve))));
  await mkdir(join(work, 'supabase'));
  await writeFile(join(work, 'supabase', 'config.toml'), `project_id = "${project}"
[api]
enabled = true
port = ${api}
schemas = ["public"]
max_rows = 1000
[db]
port = ${db}
shadow_port = ${shadow}
major_version = 17
[db.seed]
enabled = false
[db.pooler]
enabled = false
[realtime]
enabled = false
[studio]
enabled = false
[local_smtp]
enabled = false
[storage]
enabled = true
[auth]
enabled = true
site_url = "http://127.0.0.1:${api}"
[edge_runtime]
enabled = false
[analytics]
enabled = false
`);
  started = true; // Also clean up a partially started stack, by unique project only.
  console.log('Starting a fresh local-only Supabase project');
  await service('start', '--exclude', 'realtime,studio,mailpit,imgproxy,edge-runtime,logflare,vector,supavisor');
  const status = JSON.parse(await service('status', '--output', 'json'));
  const endpoint = new URL(status.API_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(endpoint.hostname));
  assert.equal(endpoint.protocol, 'http:');
  assert.equal(endpoint.port, String(api));
  assert.ok(typeof status.SERVICE_ROLE_KEY === 'string' && status.SERVICE_ROLE_KEY.length > 0);
  assert.ok(typeof status.ANON_KEY === 'string' && status.ANON_KEY.length > 0);
  const container = `supabase_db_${project}`;
  const fixtureNames = [...new Set([...((await readFile(local('supabase/functions/_shared/account-data.ts'), 'utf8')).matchAll(/\{ table: "([a-z_]+)", column:/g))].map(match => match[1]))];
  for (const name of ['trip_groups', 'documents', 'inbox_items']) assert.ok(fixtureNames.includes(name));
  const fixtureSql = fixtureNames.filter(name => !['assistant_request_quota', 'nutrition_foods', 'sport_exercise_favorites'].includes(name)).map(name => `CREATE TABLE public.${name} (
    id uuid PRIMARY KEY, user_id uuid, created_by uuid, auth_user_id uuid, trip_id uuid, expense_id uuid, member_id uuid,
    transaction_id uuid, closed_by uuid, created_at timestamptz DEFAULT now(), email text, name text, is_me boolean,
    amount numeric, storage_bucket text, storage_path text);
    ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.${name} TO service_role;`).join('\n');
  const migrations = await Promise.all([
    '20260725234344_account_data_requests.sql', '20260925012905_assistant_ai_quota.sql',
    '20261124090000_account_deletion_checkpoint.sql', '20260611090500_sport_exercise_library.sql',
    '20261125100000_account_write_admission.sql',
  ].map(name => readFile(local(`supabase/migrations/${name}`), 'utf8')));
  const nutrition = await readFile(local('supabase/migrations/20260611091500_nutrition_foundation.sql'), 'utf8');
  const foodDdl = nutrition.split('create table if not exists public.nutrition_meals')[0];
  await command(docker, ['exec', '-i', container, 'psql', '-Xq', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], {
    input: `BEGIN;\n${migrations.join('\n')}\n${fixtureSql}\n${foodDdl}\nCREATE TABLE public.f13_fixture_guard (id uuid PRIMARY KEY);
    ALTER TABLE public.f13_fixture_guard ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.f13_fixture_guard TO service_role;
    INSERT INTO public.f13_fixture_guard VALUES ('${marker}');
    ALTER TABLE public.trip_expenses
      ADD CONSTRAINT f13_fixture_trip_payment_fk FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
        ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
      ADD CONSTRAINT f13_fixture_trip_payment_second_fk FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
        ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
    CREATE POLICY f13_fixture_owner_upload ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'personal-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
    GRANT USAGE ON SCHEMA storage TO service_role;
    GRANT SELECT ON storage.objects TO service_role;
    CREATE VIEW public.f13_fixture_object_owners WITH (security_invoker = true) AS
      SELECT bucket_id, name, owner_id FROM storage.objects;
    REVOKE ALL ON public.f13_fixture_object_owners FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON public.f13_fixture_object_owners TO service_role;
    -- Only the disposable stack has this synthetic observation helper.
    CREATE FUNCTION public.f13_fixture_record_drain(p_request_id uuid, p_marker uuid)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fixture$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.f13_fixture_guard WHERE id = p_marker) THEN
        RAISE EXCEPTION 'Wrong fixture';
      END IF;
      INSERT INTO account_lifecycle_private.legacy_upload_drains(request_id, observed_closed_at)
      SELECT r.id, g.closed_at FROM public.account_deletion_requests r
      JOIN account_lifecycle_private.closed_account_writes g ON g.user_id = r.user_id
      JOIN auth.users u ON u.id = r.user_id
      WHERE r.id = p_request_id AND u.email LIKE ('travelbudget-f13-%-' || p_marker::text || '@example.test');
      IF NOT FOUND THEN RAISE EXCEPTION 'No synthetic closed account'; END IF;
    END;
    $fixture$;
    REVOKE ALL ON FUNCTION public.f13_fixture_record_drain(uuid,uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.f13_fixture_record_drain(uuid,uuid) TO service_role;
    NOTIFY pgrst, 'reload schema';\nCOMMIT;`,
  });
  console.log(await command(process.execPath, [local('node_modules/deno/bin.cjs'), 'run', '--no-config',
    `--lock=${local('config/edge-check.lock')}`, '--frozen',
    `--allow-net=127.0.0.1:${api}`, '--allow-env=F13_LOCAL_SERVICE_KEY,F13_LOCAL_ANON_KEY', local('scripts/check-account-deletion-supabase.ts'),
    `http://127.0.0.1:${api}`, marker], { env: { ...cleanEnv, F13_LOCAL_SERVICE_KEY: status.SERVICE_ROLE_KEY, F13_LOCAL_ANON_KEY: status.ANON_KEY } }));
} catch (error) {
  testFailure = error;
  throw error;
} finally {
  try {
    if (started) await service('stop', '--no-backup');
  } catch (cleanupError) {
    if (!testFailure) throw cleanupError;
    console.error(`Disposable Supabase cleanup failed: ${cleanupError.message}`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
