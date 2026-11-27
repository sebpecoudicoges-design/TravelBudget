import { test, expect } from '@playwright/test';

async function prepare(page) {
  await page.route('**/queue-tabs-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Queue test</body></html>' }));
  await page.goto('/queue-tabs-test');
  await page.evaluate(async () => {
    window.Data = await import('/src/data/mutationQueueStore.js');
    window.sbUser = { id: 'synthetic-tabs' };
    window.replayed = [];
    window.toastOk = () => {};
    window.tbTripReplayOfflineExpenseMutation = async payload => { window.replayed.push(payload.amount); };
  });
  await page.addScriptTag({ url: '/legacy/js/00_offline_queue.js' });
}

for (const failure of [false, true]) test(`browser lock prevents a second tab replay despite expired local lease, failure=${failure}`, async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  await prepare(first);
  await prepare(second);
  await first.evaluate(async () => {
    await window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 10 }, { entityId: 'one' });
    window.tbTripReplayOfflineExpenseMutation = async payload => {
      window.replayed.push(payload.amount);
      await new Promise((resolve, reject) => { window.finishReplay = failed => failed ? reject(new Error('network failure')) : resolve(); });
    };
    window.sending = window.tbOfflineQueueSync('manual');
  });
  await expect.poll(() => first.evaluate(() => window.replayed.length)).toBe(1);
  // A suspended tab can miss the local heartbeat. The browser lock must still exclude its peer.
  await second.evaluate(() => localStorage.removeItem('travelbudget_offline_queue_v2_lock_synthetic-tabs'));
  expect(await second.evaluate(() => window.tbOfflineQueueSync('manual'))).toMatchObject({ skipped: 'locked' });
  expect(await second.evaluate(() => window.replayed)).toEqual([]);
  const result = await first.evaluate(async failed => { window.finishReplay(failed); return window.sending; }, failure);
  expect(result.failed).toBe(failure ? 1 : 0);
  expect(await second.evaluate(async () => (await navigator.locks.query()).held.filter(lock => lock.name.startsWith('tb:offline-sync:')))).toEqual([]);
  const resumed = await second.evaluate(() => window.tbOfflineQueueSync('manual'));
  expect(resumed).toMatchObject({ ok: true, synced: failure ? 1 : 0 });
  expect(await second.evaluate(() => window.replayed)).toEqual(failure ? [10] : []);
  expect(await second.evaluate(() => window.tbOfflineQueueCount())).toBe(0);
});

test('another tab receives queue changes only for its active account', async ({ context }) => {
  const writer = await context.newPage();
  const reader = await context.newPage();
  await prepare(writer);
  await prepare(reader);
  await reader.evaluate(() => {
    window.peerUpdates = [];
    window.addEventListener('tb:offline_queue_changed', ev => {
      if (ev.detail.source === 'another-tab') window.peerUpdates.push(ev.detail.count);
    });
  });
  const id = await writer.evaluate(async () => (await window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 25 }, { entityId: 'x' })).id);
  await expect.poll(() => reader.evaluate(() => window.peerUpdates.slice())).toEqual([1]);
  await writer.evaluate(id => window.tbOfflineQueueRemove(id), id);
  await expect.poll(() => reader.evaluate(() => window.peerUpdates.slice())).toEqual([1, 0]);
  await writer.evaluate(async () => {
    window.sbUser = { id: 'another-synthetic-account' };
    await window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 50 }, { entityId: 'y' });
    window.sbUser = { id: 'synthetic-tabs' };
    await window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 75 }, { entityId: 'z' });
  });
  await expect.poll(() => reader.evaluate(() => window.peerUpdates.slice())).toEqual([1, 0, 1]);
  expect(await reader.evaluate(() => window.tbOfflineQueuePending().map(item => item.payload.amount))).toEqual([75]);
  expect(await reader.evaluate(() => window.replayed)).toEqual([]);
});

test('serializes concurrent writes and rejects a waiting write after account change', async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  await prepare(first);
  await prepare(second);
  await first.evaluate(() => {
    window.holdWrites = navigator.locks.request('tb:offline-write:travelbudget_offline_queue_v2_synthetic-tabs',
      () => new Promise(resolve => { window.releaseWrites = resolve; }));
  });
  await expect.poll(() => first.evaluate(() => typeof window.releaseWrites)).toBe('function');
  const stage = page => page.evaluate(amount => {
    window.writerResult = window.tbOfflineQueueEnqueue('trip.expense.create', { amount })
      .then(() => 'saved', error => error.message);
  }, page === first ? 10 : 20);
  await Promise.all([stage(first), stage(second)]);
  await expect.poll(() => first.evaluate(async () => (await navigator.locks.query()).pending
    .filter(lock => lock.name.startsWith('tb:offline-write:')).length)).toBe(2);
  expect(await first.evaluate(() => window.tbOfflineQueueCount())).toBe(0);
  await first.evaluate(() => { window.releaseWrites(); });
  expect(await first.evaluate(() => window.writerResult)).toBe('saved');
  expect(await second.evaluate(() => window.writerResult)).toBe('saved');
  expect((await second.evaluate(() => window.tbOfflineQueuePending().map(item => item.payload.amount))).sort()).toEqual([10, 20]);

  await first.evaluate(() => {
    window.releaseWrites = null;
    window.holdWrites = navigator.locks.request('tb:offline-write:travelbudget_offline_queue_v2_synthetic-tabs',
      () => new Promise(resolve => { window.releaseWrites = resolve; }));
  });
  await expect.poll(() => first.evaluate(() => typeof window.releaseWrites)).toBe('function');
  await stage(second);
  await second.evaluate(() => { window.sbUser = { id: 'second-account' }; });
  await first.evaluate(() => { window.releaseWrites(); });
  expect(await second.evaluate(() => window.writerResult)).toContain('compte a change');
  expect(await second.evaluate(() => window.tbOfflineQueueCount())).toBe(0);
  expect(await first.evaluate(() => window.tbOfflineQueueCount())).toBe(2);
});

test('another tab can enqueue while a previous action awaits the server', async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  await prepare(first);
  await prepare(second);
  await first.evaluate(async () => {
    await window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 10 }, { entityId: 'one' });
    window.tbTripReplayOfflineExpenseMutation = () => new Promise(resolve => { window.finishReplay = resolve; });
    window.sending = window.tbOfflineQueueSync('manual');
  });
  await expect.poll(() => first.evaluate(() => typeof window.finishReplay)).toBe('function');
  await second.evaluate(() => window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 20 }, { entityId: 'one' }));
  await first.evaluate(() => { window.finishReplay(); });
  expect(await first.evaluate(() => window.sending)).toMatchObject({ synced: 0, failed: 0 });
  expect(await second.evaluate(() => window.tbOfflineQueuePending().map(item => item.payload.amount))).toEqual([20]);
  expect(await second.evaluate(() => window.tbOfflineQueueSync('manual'))).toMatchObject({ synced: 1 });
  expect(await second.evaluate(() => window.replayed)).toEqual([20]);
});

test('without Web Locks, two tabs wait for the write gate and keep the old queue', async ({ context }) => {
  await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  const first = await context.newPage();
  const second = await context.newPage();
  await prepare(first);
  await prepare(second);
  await first.evaluate(async () => {
    localStorage.setItem('travelbudget_offline_queue_v2_synthetic-tabs', JSON.stringify({
      version: 3,
      items: [{ id: 'older-action', kind: 'trip.expense.create', status: 'pending', payload: { amount: 5 } }],
    }));
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('travelbudget_offline_queue_write_gate', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('queue');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const transaction = db.transaction('queue', 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
    const store = transaction.objectStore('queue');
    await new Promise(resolve => {
      let hold = true;
      window.releaseWriteGate = () => { hold = false; };
      const next = () => {
        const r = store.get('fixture');
        r.onsuccess = () => { if (hold) next(); };
      };
      const initial = store.get('fixture');
      initial.onsuccess = () => { next(); resolve(); };
    });
  });
  const enqueue = (page, amount) => page.evaluate(amount => {
    window.writeState = 'waiting';
    window.writeResult = Promise.resolve(window.tbOfflineQueueEnqueue('trip.expense.create', { amount }))
      .then(() => { window.writeState = 'saved'; }, error => { window.writeState = error.message; });
  }, amount);

  try {
    await Promise.all([enqueue(first, 10), enqueue(second, 20)]);
    expect(await first.evaluate(() => window.writeState)).toBe('waiting');
    expect(await second.evaluate(() => window.writeState)).toBe('waiting');
    expect(await second.evaluate(() => window.tbOfflineQueuePending().map(x => x.id))).toEqual(['older-action']);
    // Changing account while a write waits must not put the action in either account.
    await second.evaluate(() => { window.sbUser = { id: 'other-account' }; });
  } finally {
    await first.evaluate(() => window.releaseWriteGate());
  }
  await first.evaluate(() => window.writeResult);
  await second.evaluate(() => window.writeResult);
  expect(await first.evaluate(() => window.writeState)).toBe('saved');
  expect(await second.evaluate(() => window.writeState)).toContain('compte a change');
  expect(await second.evaluate(() => window.tbOfflineQueueCount())).toBe(0);
  await second.evaluate(() => { window.sbUser = { id: 'synthetic-tabs' }; });

  await Promise.all([enqueue(first, 15), enqueue(second, 20)]);
  await Promise.all([first.evaluate(() => window.writeResult), second.evaluate(() => window.writeResult)]);
  await second.reload();
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('travelbudget_offline_queue_v2_synthetic-tabs')).items
    .map(item => item.payload.amount).sort((a, b) => a - b))).toEqual([5, 10, 15, 20]);
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('travelbudget_offline_queue_v2_synthetic-tabs')).items[0].id))
    .toBe('older-action');
});

test('without Web Locks, an unavailable write gate leaves the saved queue intact', async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    Object.defineProperty(window, 'indexedDB', {
      value: { open() { throw new Error('Fixture: gate unavailable'); } },
    });
  });
  const page = await context.newPage();
  await prepare(page);
  expect(await page.evaluate(async () => {
    const key = 'travelbudget_offline_queue_v2_synthetic-tabs';
    const original = JSON.stringify({ version: 3, items: [{ id: 'kept' }] });
    localStorage.setItem(key, original);
    let acknowledged = false;
    let error;
    window.toastOk = () => { acknowledged = true; };
    try { await window.tbOfflineQueueEnqueue('trip.expense.create', { amount: 25 }); }
    catch (cause) { error = cause.message; }
    return { same: original === localStorage.getItem(key), acknowledged, error };
  })).toEqual({ same: true, acknowledged: false, error: expect.stringMatching(/Offline storage unavailable|Stockage hors ligne indisponible/) });
});
