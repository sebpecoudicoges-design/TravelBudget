import { describe, expect, it } from 'vitest';
import { createMutationQueueStore, flushMutationQueue } from '../../src/data/mutationQueueStore.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('mutation queue store', () => {
  it('deduplicates an idempotent mutation', () => {
    const queue = createMutationQueueStore({ storage: memoryStorage(), queueKey: 'q', now: () => 1_000, idFactory: () => 'm1' });
    queue.enqueue('transaction.apply_v2', { args: { p_offline_dedupe_key: 'tx-1' } });
    const result = queue.enqueue('transaction.apply_v2', { args: { p_offline_dedupe_key: 'tx-1' }, changed: true });
    expect(result.deduplicated).toBe(true);
    expect(queue.count()).toBe(1);
    expect(queue.read()[0].payload.changed).toBe(true);
  });

  it('keeps separate mutations when no dedupe identity exists', () => {
    let nextId = 0;
    const queue = createMutationQueueStore({ storage: memoryStorage(), queueKey: 'q', now: () => 1_000, idFactory: () => `m${++nextId}` });
    queue.enqueue('transaction.delete', { txId: 'tx-1' });
    queue.enqueue('transaction.delete', { txId: 'tx-2' });
    expect(queue.count()).toBe(2);
  });

  it('defers a failed mutation without hiding later runnable items', () => {
    let timestamp = 10_000;
    let nextId = 0;
    const queue = createMutationQueueStore({
      storage: memoryStorage(),
      queueKey: 'q',
      now: () => timestamp,
      idFactory: () => `m${++nextId}`,
    });
    queue.enqueue('first', {}, { entityId: '1' });
    queue.enqueue('second', {}, { entityId: '2' });
    queue.beginAttempt('m1');
    queue.markFailure('m1', new Error('network'));
    expect(queue.runnable().map((item) => item.id)).toEqual(['m2']);
    timestamp += 5_001;
    expect(queue.runnable().map((item) => item.id)).toEqual(['m1', 'm2']);
  });

  it('uses a lock to prevent concurrent queue flushes', () => {
    const storage = memoryStorage();
    const first = createMutationQueueStore({ storage, queueKey: 'q', lockKey: 'lock', owner: 'a', now: () => 1_000 });
    const second = createMutationQueueStore({ storage, queueKey: 'q', lockKey: 'lock', owner: 'b', now: () => 1_000 });
    expect(first.acquireLock()).toBe(true);
    expect(second.acquireLock()).toBe(false);
    first.releaseLock();
    expect(second.acquireLock()).toBe(true);
  });

  it('continues after a retryable failure instead of blocking later mutations', async () => {
    let nextId = 0;
    const queue = createMutationQueueStore({ storage: memoryStorage(), queueKey: 'q', now: () => 10_000, idFactory: () => `m${++nextId}` });
    queue.enqueue('first', {}, { entityId: '1' });
    queue.enqueue('second', {}, { entityId: '2' });
    const result = await flushMutationQueue({
      store: queue,
      run: async (item) => { if (item.id === 'm1') throw new Error('network'); },
    });
    expect(result).toMatchObject({ synced: 1, failed: 1, attempted: 2 });
    expect(queue.read().map((item) => item.id)).toEqual(['m1']);
    expect(queue.read()[0].error).toBe('network');
  });
});
