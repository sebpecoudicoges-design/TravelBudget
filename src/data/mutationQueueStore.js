const QUEUE_VERSION = 3;
const RETRY_DELAYS_MS = [0, 5_000, 30_000, 120_000, 600_000];

function asTimestamp(value, fallback = 0) {
  const timestamp = typeof value === 'number' ? value : Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

export function retryDelayForAttempt(attempts) {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, Number(attempts || 0)));
  return RETRY_DELAYS_MS[index];
}

export function mutationDedupeKey(kind, payload, meta) {
  const direct = meta?.dedupeKey
    || payload?.dedupeKey
    || payload?.coreArgs?.offlineDedupeKey
    || payload?.args?.p_offline_dedupe_key;
  const explicit = String(direct || '').trim();
  if (explicit) return explicit;
  const entityId = String(meta?.entityId || '').trim();
  return entityId ? `${String(kind || 'unknown')}:${entityId}` : '';
}

export function createMutationQueueStore(options = {}) {
  const storage = options.storage;
  const now = options.now || (() => Date.now());
  const nowISO = () => new Date(now()).toISOString();
  const queueKey = () => String(typeof options.queueKey === 'function' ? options.queueKey() : options.queueKey || 'tb_mutation_queue');
  const lockKey = () => String(typeof options.lockKey === 'function' ? options.lockKey() : options.lockKey || `${queueKey()}_lock`);
  const owner = String(options.owner || `queue_${Math.random().toString(16).slice(2)}`);
  const lockTtlMs = Number(options.lockTtlMs) || 45_000;
  const staleSyncMs = Number(options.staleSyncMs) || 60_000;

  function emit(items, detail = {}) {
    options.onChange?.(items.map((item) => ({ ...item })), detail);
  }

  function normalize(item) {
    if (!item || typeof item !== 'object' || !item.id) return null;
    const updatedAt = item.updatedAt || item.createdAt || nowISO();
    const staleSync = item.status === 'syncing' && now() - asTimestamp(updatedAt, now()) > staleSyncMs;
    return {
      ...item,
      kind: String(item.kind || 'unknown'),
      status: staleSync ? 'pending' : String(item.status || 'pending'),
      attempts: Math.max(0, Number(item.attempts) || 0),
      createdAt: item.createdAt || updatedAt,
      updatedAt,
      payload: item.payload && typeof item.payload === 'object' ? item.payload : {},
      meta: item.meta && typeof item.meta === 'object' ? item.meta : {},
    };
  }

  function read() {
    try {
      const parsed = JSON.parse(storage?.getItem(queueKey()) || 'null');
      if (!parsed || !Array.isArray(parsed.items)) return [];
      return parsed.items.map(normalize).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function write(items, detail = {}) {
    const clean = (Array.isArray(items) ? items : []).map(normalize).filter(Boolean);
    storage?.setItem(queueKey(), JSON.stringify({ version: QUEUE_VERSION, savedAt: nowISO(), items: clean }));
    emit(clean, detail);
    return clean;
  }

  function enqueue(kind, payload = {}, meta = {}, enqueueOptions = {}) {
    const items = read();
    const normalizedKind = String(kind || 'unknown');
    const dedupeKey = mutationDedupeKey(normalizedKind, payload, meta);
    const existing = items.find((item) => item.kind === normalizedKind && item.status !== 'done' && (
      enqueueOptions.singleton || (dedupeKey && mutationDedupeKey(item.kind, item.payload, item.meta) === dedupeKey)
    ));
    if (existing) {
      existing.payload = { ...existing.payload, ...payload };
      existing.meta = { ...existing.meta, ...meta, dedupeKey };
      existing.status = 'pending';
      existing.error = null;
      existing.nextAttemptAt = null;
      existing.updatedAt = nowISO();
      write(items, { type: 'deduplicated', id: existing.id });
      return { item: existing, deduplicated: true };
    }

    const item = {
      id: options.idFactory?.(normalizedKind) || `mutation_${now()}_${Math.random().toString(16).slice(2)}`,
      kind: normalizedKind,
      status: 'pending',
      attempts: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      nextAttemptAt: null,
      payload,
      meta: { ...meta, dedupeKey },
    };
    items.push(item);
    write(items, { type: 'enqueued', id: item.id });
    return { item, deduplicated: false };
  }

  function updateItem(id, updater, detail = {}) {
    const items = read();
    const item = items.find((candidate) => String(candidate.id) === String(id));
    if (!item) return null;
    updater(item);
    item.updatedAt = nowISO();
    write(items, { ...detail, id: item.id });
    return item;
  }

  function beginAttempt(id) {
    return updateItem(id, (item) => {
      item.status = 'syncing';
      item.attempts += 1;
      item.error = null;
      item.nextAttemptAt = null;
    }, { type: 'attempt' });
  }

  function markFailure(id, error) {
    return updateItem(id, (item) => {
      item.status = 'pending';
      item.error = String(error?.message || error || 'Erreur de synchronisation');
      item.nextAttemptAt = new Date(now() + retryDelayForAttempt(item.attempts)).toISOString();
    }, { type: 'failed' });
  }

  function remove(id) {
    const items = read();
    const next = items.filter((item) => String(item.id) !== String(id));
    write(next, { type: 'removed', id: String(id) });
    return next.length !== items.length;
  }

  function runnable(force = false) {
    const timestamp = now();
    return read().filter((item) => item.status !== 'done' && item.status !== 'syncing' && (
      force || !item.nextAttemptAt || asTimestamp(item.nextAttemptAt, 0) <= timestamp
    ));
  }

  function readLock() {
    try { return JSON.parse(storage?.getItem(lockKey()) || 'null'); } catch (_) { return null; }
  }

  function acquireLock(reason = 'sync') {
    const current = readLock();
    if (current?.owner && current.owner !== owner && Number(current.expiresAt || 0) > now()) return false;
    storage?.setItem(lockKey(), JSON.stringify({ owner, reason, createdAt: now(), expiresAt: now() + lockTtlMs }));
    return readLock()?.owner === owner;
  }

  function releaseLock() {
    const current = readLock();
    if (!current || current.owner === owner) storage?.removeItem(lockKey());
  }

  return {
    read,
    write,
    enqueue,
    beginAttempt,
    markFailure,
    remove,
    runnable,
    count: () => read().filter((item) => item.status !== 'done').length,
    acquireLock,
    releaseLock,
  };
}

export async function flushMutationQueue({ store, run, force = false, isPermanentFailure, onSuccess, onPermanentFailure } = {}) {
  if (!store || typeof run !== 'function') throw new TypeError('Queue store and runner are required.');
  const items = store.runnable(force);
  let synced = 0;
  let failed = 0;
  let discarded = 0;

  for (const item of items) {
    const current = store.beginAttempt(item.id) || item;
    try {
      await run(current);
      await onSuccess?.(current);
      store.remove(item.id);
      synced += 1;
    } catch (error) {
      if (isPermanentFailure?.(current, error)) {
        await onPermanentFailure?.(current, error);
        store.remove(item.id);
        discarded += 1;
        continue;
      }
      store.markFailure(item.id, error);
      failed += 1;
    }
  }

  return { ok: failed === 0, synced, failed, discarded, attempted: items.length };
}
