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
  it.each(['enqueue', 'attempt', 'remove'])('refuses a stale %s when another writer changes the queue', operation => {
    const storage = memoryStorage();
    const first = createMutationQueueStore({ storage, queueKey: 'q' });
    const second = createMutationQueueStore({ storage, queueKey: 'q' });
    const { item } = first.enqueue('existing');
    const getItem = storage.getItem;
    let reads = 0;
    storage.getItem = key => {
      if (key === 'q' && ++reads === 2) {
        storage.getItem = getItem;
        second.enqueue('other-tab');
      }
      return getItem(key);
    };
    const change = { enqueue: () => first.enqueue('new'), attempt: () => first.beginAttempt(item.id), remove: () => first.remove(item.id) }[operation];
    expect(change).toThrow('modifiee depuis sa lecture');
    expect(second.read().map(row => row.kind)).toEqual(['existing', 'other-tab']);
    expect(second.read()[0].status).toBe('pending');
  });

  it('refuses a filtered stale snapshot and a snapshot from a previous account', () => {
    const storage = memoryStorage();
    let scope = 'a';
    const queue = createMutationQueueStore({ storage, queueKey: () => scope });
    queue.enqueue('keep');
    const before = queue.read();
    queue.enqueue('new');
    expect(() => queue.write([], {}, before)).toThrow('modifiee depuis sa lecture');
    const current = queue.read();
    scope = 'b';
    expect(() => queue.write(current)).toThrow('modifiee depuis sa lecture');
    expect(storage.getItem('b')).toBeNull();
    scope = 'a';
    expect(queue.read().map(row => row.kind)).toEqual(['keep', 'new']);
  });

  it.each(['success', 'permanent'])('does not clean visible state when %s acknowledgement cannot be persisted', async outcome => {
    const storage = memoryStorage();
    const queue = createMutationQueueStore({ storage, queueKey: 'q' });
    queue.enqueue('existing');
    let cleaned = false;
    const setItem = storage.setItem;
    await expect(flushMutationQueue({ store: queue,
      run: async () => {
        storage.setItem = () => { throw new Error('Quota exceeded'); };
        if (outcome === 'permanent') throw new Error('Permanent failure');
      },
      isPermanentFailure: (_, error) => error.message === 'Permanent failure',
      onSuccess: () => { cleaned = true; }, onPermanentFailure: () => { cleaned = true; },
    })).rejects.toThrow('Quota exceeded');
    expect(cleaned).toBe(false);
    storage.setItem = setItem;
    expect(queue.read()).toHaveLength(1);
  });

  it.each(['{broken', 'null', '{}', '{"items":[{"id":"kept"},null]}'])('preserves unreadable persisted data: %s', raw => {
    const storage = memoryStorage();
    storage.setItem('q', raw);
    const queue = createMutationQueueStore({ storage, queueKey: 'q' });
    for (const change of [() => queue.enqueue('new'), () => queue.remove('kept'), () => queue.write([])]) {
      expect(change).toThrow();
      expect(storage.getItem('q')).toBe(raw);
    }
  });

  it('does not convert a transient read failure into an empty replacement queue', () => {
    const storage = memoryStorage();
    const queue = createMutationQueueStore({ storage, queueKey: 'q' });
    queue.enqueue('existing');
    const getItem = storage.getItem;
    storage.getItem = () => { throw new Error('Read unavailable'); };
    expect(() => queue.enqueue('new')).toThrow('Read unavailable');
    storage.getItem = getItem;
    expect(queue.read().map(item => item.kind)).toEqual(['existing']);
  });

  it('keeps a slow attempt protected while its owner renews the lease', () => {
    const storage = memoryStorage();
    let time = 1_000;
    const first = createMutationQueueStore({ storage, queueKey: 'q', owner: 'a', now: () => time });
    const second = createMutationQueueStore({ storage, queueKey: 'q', owner: 'b', now: () => time });
    const { item } = first.enqueue('slow');
    expect(first.acquireLock()).toBe(true);
    first.beginAttempt(item.id);
    for (let i = 0; i < 9; i += 1) {
      time += 10_000;
      expect(first.renewLock()).toBe(true);
      expect(second.acquireLock()).toBe(false);
    }
    expect(second.runnable()).toEqual([]);
    first.releaseLock();
    expect(second.acquireLock()).toBe(true);
    expect(second.runnable().map(row => row.id)).toEqual([item.id]);
  });

  it('does not revive an expired lease or delete a replacement owner lock', () => {
    const storage = memoryStorage();
    let time = 1_000;
    const first = createMutationQueueStore({ storage, queueKey: 'q', owner: 'a', now: () => time });
    const second = createMutationQueueStore({ storage, queueKey: 'q', owner: 'b', now: () => time });
    first.acquireLock();
    time += 45_001;
    expect(first.renewLock()).toBe(false);
    expect(second.acquireLock()).toBe(true);
    expect(first.renewLock()).toBe(false);
    first.releaseLock();
    expect(second.renewLock()).toBe(true);
  });

  it('cannot renew a previous account lease after changing scope', () => {
    const storage = memoryStorage();
    let scope = 'a';
    const queue = createMutationQueueStore({ storage, queueKey: () => scope });
    queue.acquireLock();
    scope = 'b';
    expect(queue.renewLock()).toBe(false);
    queue.releaseLock();
    expect(storage.getItem('a_lock')).toBeNull();
    expect(storage.getItem('b_lock')).toBeNull();
  });

  it('stops before the next mutation when ownership is lost during a request', async () => {
    const queue = createMutationQueueStore({ storage: memoryStorage() });
    queue.enqueue('first');
    queue.enqueue('second');
    let owned = true;
    const result = await flushMutationQueue({ store: queue, canContinue: () => owned, run: async () => { owned = false; } });
    expect(result.attempted).toBe(1);
    expect(queue.read().map(row => row.kind)).toEqual(['second']);
  });

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
