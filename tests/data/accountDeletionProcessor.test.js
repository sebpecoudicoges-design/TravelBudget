import { expect, it, vi } from 'vitest';
import { processAccountDeletions } from '../../supabase/functions/process-account-deletions/processor.ts';

const now = () => new Date('2026-11-24T00:00:00Z');
const request = (id, patch = {}) => ({ id, user_id: `user-${id}`, status: 'pending', execute_after: '2026-11-23T00:00:00Z', processing_started_at: null, attempt_count: 0, ...patch });
function database(rows, fail = () => false) {
  return { from: () => {
    let patch; const predicates = [];
    const query = {
      select: () => query, order: () => query, limit: () => query,
      update: value => { patch = value; return query; },
      eq: (key, value) => { predicates.push(row => row[key] === value); return query; },
      is: (key, value) => { predicates.push(row => row[key] === value); return query; },
      lte: (key, value) => { predicates.push(row => row[key] <= value); return query; },
      not: key => { predicates.push(row => row[key] != null); return query; },
      or: filter => {
        if (filter.startsWith('user_id.')) predicates.push(row => row.user_id != null || row.status === 'processing' && row.data_purged_at != null);
        else { const cutoff = filter.match(/processing_started_at\.lt\.(.*)\)$/)[1]; predicates.push(row => row.status === 'pending' || (row.status === 'processing' && row.processing_started_at && row.processing_started_at < cutoff)); }
        return query;
      },
      then: resolve => {
        if (fail(patch)) return Promise.resolve(resolve({ data: null, error: new Error('database unavailable') }));
        const matches = rows.filter(row => predicates.every(predicate => predicate(row)));
        if (patch) matches.forEach(row => Object.assign(row, patch));
        return Promise.resolve(resolve({ data: structuredClone(matches), error: null }));
      },
      maybeSingle: async () => { const result = await query; return { ...result, data: result.data?.[0] || null }; },
    };
    return query;
  } };
}

it('recovers only expired processing and due pending requests', async () => {
  const rows = [request('due'), request('stale', { status: 'processing', processing_started_at: '2026-11-23T23:00:00Z' }),
    request('active', { status: 'processing', processing_started_at: '2026-11-23T23:59:00Z' }),
    request('unknown', { status: 'processing' }), request('cancelled', { status: 'cancelled' }),
    request('failed', { status: 'failed' }), request('future', { execute_after: '2026-11-25' }), request('gone', { user_id: null })];
  const purge = vi.fn(async () => ({ removed: 1 }));
  const result = await processAccountDeletions(database(rows), purge, now);
  expect(result.processed).toBe(2);
  expect(purge.mock.calls.map(call => call[1])).toEqual(['user-due', 'user-stale']);
  expect(rows.slice(0, 2).every(row => row.status === 'completed' && row.user_id === null)).toBe(true);
  expect(rows[2].status).toBe('processing');
});

it.each(['pending', 'processing'])('allows only one claimant for a %s request', async status => {
  const rows = [request('one', { status, processing_started_at: '2026-11-23T23:00:00Z' })];
  const admin = database(rows);
  const purge = vi.fn(async () => ({}));
  const results = await Promise.all([processAccountDeletions(admin, purge, now), processAccountDeletions(admin, purge, now)]);
  expect(purge).toHaveBeenCalledOnce();
  expect(results.reduce((sum, result) => sum + result.processed, 0)).toBe(1);
});

it.each(['claim', 'completion', 'failure'])('propagates a database error during %s', async phase => {
  const rows = [request('one', { attempt_count: phase === 'failure' ? 2 : 0 })];
  const admin = database(rows, patch => patch?.status === { claim: 'processing', completion: 'completed', failure: 'failed' }[phase]);
  const purge = vi.fn(async () => { if (phase === 'failure') throw new Error('purge failed'); return {}; });
  await expect(processAccountDeletions(admin, purge, now)).rejects.toThrow('database unavailable');
  expect(rows[0].status).toBe(phase === 'claim' ? 'pending' : 'processing');
  expect(purge).toHaveBeenCalledTimes(phase === 'claim' ? 0 : 1);
});

it('does not acknowledge an attempt whose ownership changed', async () => {
  const rows = [request('one')];
  await expect(processAccountDeletions(database(rows), async () => {
    rows[0].processing_started_at = '2026-11-24T01:00:00Z'; return {};
  }, now)).rejects.toThrow('ownership lost');
  expect(rows[0].status).toBe('processing');
});

it('records a purge failure and keeps the user reference for investigation', async () => {
  const rows = [request('one')];
  const result = await processAccountDeletions(database(rows), async () => { throw new Error('storage failed'); }, now);
  expect(result.results[0]).toMatchObject({ status: 'processing', retryScheduled: true, error: 'storage failed' });
  expect(rows[0]).toMatchObject({ status: 'processing', user_id: 'user-one', attempt_count: 1 });
});

it('reconciles a crash after Auth deletion only with a persisted checkpoint', async () => {
  const rows = [request('one')];
  const admin = database(rows, patch => patch?.status === 'completed');
  await expect(processAccountDeletions(admin, async (_admin, _id, checkpoint) => {
    await checkpoint(); rows[0].user_id = null; return {};
  }, now)).rejects.toThrow('database unavailable');
  expect(rows[0]).toMatchObject({ status: 'processing', user_id: null, data_purged_at: now().toISOString() });
  const purge = vi.fn();
  const later = () => new Date('2026-11-24T01:00:00Z');
  rows.push(request('unproven', { status: 'processing', user_id: null, processing_started_at: now().toISOString() }));
  const result = await processAccountDeletions(database(rows), purge, later);
  expect(result.results).toEqual([{ id: 'one', status: 'completed', reconciled: true }]);
  expect(purge).not.toHaveBeenCalled();
  expect(rows[1].status).toBe('processing');
});

it('does not allow a checkpoint failure to reach Auth deletion', async () => {
  const rows = [request('one')];
  const deleteAuth = vi.fn();
  await processAccountDeletions(database(rows, patch => !!patch?.data_purged_at), async (_admin, _id, checkpoint) => {
    await checkpoint(); deleteAuth(); return {};
  }, now);
  expect(deleteAuth).not.toHaveBeenCalled();
  expect(rows[0].status).toBe('processing');
});

it('invalidates an old checkpoint when restarting a purge for an existing user', async () => {
  const rows = [request('one', { status: 'processing', processing_started_at: '2026-11-23T22:00:00Z', data_purged_at: '2026-11-23T22:01:00Z' })];
  await processAccountDeletions(database(rows), async () => {
    expect(rows[0].data_purged_at).toBeNull();
    throw new Error('new cleanup failed');
  }, now);
  expect(rows[0]).toMatchObject({ status: 'processing', data_purged_at: null });
});

it.each([true, false])('keeps an ambiguous Auth outcome recoverable, user still exists=%s', async userExists => {
  const rows = [request('one')];
  await expect(processAccountDeletions(database(rows), async (_admin, _id, checkpoint) => {
    await checkpoint();
    if (!userExists) rows[0].user_id = null;
    throw new Error('Auth response lost');
  }, now)).rejects.toThrow('Auth response lost');
  expect(rows[0]).toMatchObject({ status: 'processing', data_purged_at: now().toISOString(), failure_reason: 'Auth response lost' });
  const retry = vi.fn(async (_admin, _id, checkpoint) => { await checkpoint(); return {}; });
  const result = await processAccountDeletions(database(rows), retry, () => new Date('2026-11-24T01:00:00Z'));
  expect(result.results[0].status).toBe('completed');
  expect(retry).toHaveBeenCalledTimes(userExists ? 1 : 0);
  if (!userExists) expect(result.results[0].reconciled).toBe(true);
});

it('still completes other due requests when an Auth response is lost', async () => {
  const rows = [request('uncertain'), request('independent')];
  const purge = vi.fn(async (_admin, id, checkpoint) => {
    await checkpoint();
    if (id === 'user-uncertain') throw new Error('Auth response lost');
    return {};
  });
  await expect(processAccountDeletions(database(rows), purge, now)).rejects.toThrow('Auth response lost');
  expect(rows[0]).toMatchObject({ status: 'processing', data_purged_at: now().toISOString(), failure_reason: 'Auth response lost' });
  expect(rows[1]).toMatchObject({ status: 'completed', user_id: null });
});


it('retries cleanup after the cooldown, then protects against unlimited pre-checkpoint failures', async () => {
  const rows = [request('one')];
  const admin = database(rows);
  const temporaryFailure = vi.fn(async () => { throw new Error('temporary local dependency outage'); });
  const later = hours => () => new Date(`2026-11-24T0${hours}:00:00Z`);
  await processAccountDeletions(admin, temporaryFailure, now);
  expect((await processAccountDeletions(admin, temporaryFailure, now)).processed).toBe(0);
  await processAccountDeletions(admin, temporaryFailure, later(1));
  const result = await processAccountDeletions(admin, temporaryFailure, later(2));
  expect(result.results[0]).toMatchObject({ status: 'failed', retryScheduled: false });
  expect(rows[0]).toMatchObject({ status: 'failed', attempt_count: 3, user_id: 'user-one' });
  expect((await processAccountDeletions(admin, temporaryFailure, later(3))).processed).toBe(0);
  expect(temporaryFailure).toHaveBeenCalledTimes(3);
});

it('completes after a transient pre-checkpoint failure and does not stall another request', async () => {
  const rows = [request('one'), request('other')];
  const admin = database(rows);
  const purge = vi.fn(async (_admin, id, checkpoint) => {
    if (id === 'user-one' && rows[0].attempt_count === 1) throw new Error('temporary local dependency outage');
    await checkpoint();
    return {};
  });
  const result = await processAccountDeletions(admin, purge, now);
  expect(result.results.map(row => row.status)).toEqual(['processing', 'completed']);
  await processAccountDeletions(admin, purge, () => new Date('2026-11-24T01:00:00Z'));
  expect(rows[0]).toMatchObject({ status: 'completed', attempt_count: 2 });
});
