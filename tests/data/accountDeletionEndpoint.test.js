import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), process: vi.fn() }));
vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({ createClient: mocks.createClient }));
vi.mock('../../supabase/functions/process-account-deletions/processor.ts', () => ({ processAccountDeletions: mocks.process }));

let handler;
const env = new Map();
const admin = { marker: 'synthetic admin' };
beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: key => env.get(key) }, serve: fn => { handler = fn; } });
  // Import the actual deployed entry point; only its backend is substituted.
  await import('../../supabase/functions/process-account-deletions/index.ts');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  env.clear();
  env.set('ACCOUNT_DELETION_PROCESSOR_SECRET', 'synthetic-secret');
  env.set('SUPABASE_URL', 'https://example.invalid');
  env.set('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-key');
  mocks.createClient.mockReturnValue(admin);
  mocks.process.mockResolvedValue({ processed: 0, results: [] });
});
function request(method = 'POST', secret) {
  return new Request('https://example.invalid/process-account-deletions', {
    method, headers: secret === undefined ? {} : { 'x-account-deletion-secret': secret },
  });
}

it.each([undefined, '', 'incorrect'])('rejects a missing or invalid processor secret (%s) before opening a backend', async secret => {
  const response = await handler(request('POST', secret));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Unauthorized' });
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.process).not.toHaveBeenCalled();
});

it.each([undefined, ''])('fails closed when the server secret is unconfigured (%s)', async value => {
  env.set('ACCOUNT_DELETION_PROCESSOR_SECRET', value);
  const response = await handler(request('POST', 'synthetic-secret'));
  expect(response.status).toBe(401);
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.process).not.toHaveBeenCalled();
});

it.each(['GET', 'PUT', 'DELETE'])('rejects %s even with a correct secret', async method => {
  expect((await handler(request(method, 'synthetic-secret'))).status).toBe(405);
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.process).not.toHaveBeenCalled();
});

it('answers preflight without creating an admin client or starting deletion', async () => {
  const response = await handler(request('OPTIONS'));
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.process).not.toHaveBeenCalled();
});

it('runs one processor invocation for an authorized POST', async () => {
  const response = await handler(request('POST', 'synthetic-secret'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ processed: 0, results: [] });
  expect(mocks.createClient).toHaveBeenCalledOnce();
  expect(mocks.process).toHaveBeenCalledExactlyOnceWith(admin, expect.any(Function));
});

it('reports backend failure without returning a successful deletion response', async () => {
  mocks.process.mockRejectedValue(new Error('synthetic persistence failure'));
  const response = await handler(request('POST', 'synthetic-secret'));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'synthetic persistence failure' });
  expect(mocks.process).toHaveBeenCalledOnce();
});
