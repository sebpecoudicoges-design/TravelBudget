// Audit-only store contract. Do not connect it to the live Nutrition queue.
export const auditConflictStore = 'audit-meal-conflicts';

// A caller provides an already open, isolated IndexedDB database, with a
// store keyed by [userId, syncId]. Never fall back to an unlocked write.
function compareAndChange({ db, reviewed, contextCurrent, signal }, apply) {
  return new Promise((resolve, reject) => {
    const { userId, syncId, localRevision } = reviewed ?? {};
    if (![userId, syncId, localRevision].every(value => typeof value === 'string' && value.length > 0)
      || typeof contextCurrent !== 'function') throw new TypeError('Invalid local conflict scope');
    if (contextCurrent(reviewed) !== true) return resolve(false);
    if (signal?.aborted) return reject(signal.reason);

    const tx = db.transaction(auditConflictStore, 'readwrite');
    let matched = false;
    let failure;
    const abort = () => {
      try { tx.abort(); } catch (error) {
        if (error.name !== 'InvalidStateError') failure = error;
      }
    };
    tx.oncomplete = () => {
      signal?.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else resolve(matched);
    };
    tx.onabort = () => {
      signal?.removeEventListener('abort', abort);
      reject(failure ?? tx.error ?? signal?.reason ?? new Error('Nutrition storage transaction aborted'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    const store = tx.objectStore(auditConflictStore);
    const key = [userId, syncId];
    const read = store.get(key);
    read.onsuccess = () => {
      try {
        const stored = read.result;
        if (contextCurrent(reviewed) !== true || stored?.userId !== userId || stored?.syncId !== syncId
          || stored?.revision !== localRevision) return;
        matched = apply(store, key, stored);
      } catch (error) {
        failure = error;
        abort();
      }
    };
  });
}

export function removeReviewedMealConflict(options) {
  return compareAndChange(options, (store, key, stored) => {
    if (stored.status !== 'conflict') return false;
    store.delete(key);
    return true;
  });
}

export function recordDeletedMealConflict(options) {
  const replay = options?.replay;
  if (replay?.status !== 'deleted' || replay.disposition !== 'pending' || replay.mealId !== null) {
    throw new TypeError('Deleted meal evidence required');
  }
  return compareAndChange(options, (store, _key, stored) => {
    if (!['pending', 'conflict'].includes(stored.status)) return false;
    store.put({ ...stored, status: 'deleted-conflict' });
    return true;
  });
}
