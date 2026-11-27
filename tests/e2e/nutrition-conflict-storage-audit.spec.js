import { expect, test } from '@playwright/test';

async function auditTab(context) {
  const page = await context.newPage();
  await page.goto('/f4-audit-idb');
  await page.evaluate(async () => {
    const queue = await import('/scripts/audit-nutrition/local-conflict-store.mjs');
    const choice = await import('/scripts/audit-nutrition/atomic-meal-conflict.mjs');
    const storeName = queue.auditConflictStore;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('travelbudget-nutrition-audit-fixture', 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: ['userId', 'syncId'] });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const userId = '00000000-0000-4000-8000-000000000001';
    const otherUser = '00000000-0000-4000-8000-000000000002';
    const syncId = 'audit-nutrition';
    const mealId = '00000000-0000-4000-8000-000000000003';
    const reviewed = choice.prepareMealConflict({
      pending: { userId, syncId, revision: 'r1' },
      replay: { status: 'conflict', disposition: 'pending', mealId },
      remote: { userId, syncId, mealId, revision: 'remote-v1' },
    });
    const transact = (mode, action) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request?.result);
      tx.onabort = () => reject(tx.error);
    });
    window.audit = {
      put: (revision = 'r1', status = 'conflict', account = userId) =>
        transact('readwrite', store => store.put({ userId: account, syncId, revision, status })),
      all: () => transact('readonly', store => store.getAll()),
      accept: (signal, contextCurrent = () => true) => choice.resolveMealConflict({
        preview: reviewed, choice: 'accept-remote', contextCurrent,
        readRemote: async () => ({ userId, syncId, mealId, revision: 'remote-v1' }),
        removeLocalIfCurrent: expected => queue.removeReviewedMealConflict({
          db, reviewed: expected, contextCurrent, signal,
        }),
      }),
    };
  });
  return page;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/f4-audit-idb', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Isolated Nutrition queue fixture</title>',
  }));
});

test('two tabs accept once without touching the same key in another account', async ({ context }) => {
  const a = await auditTab(context);
  const b = await auditTab(context);
  await a.evaluate(async () => {
    await audit.put();
    await audit.put('other-r1', 'conflict', '00000000-0000-4000-8000-000000000002');
  });
  const results = await Promise.all([a.evaluate(() => audit.accept()), b.evaluate(() => audit.accept())]);
  expect(results.sort()).toEqual(['accepted-remote', 'stale-local']);
  await b.close();
  const reloaded = await auditTab(context);
  expect(await reloaded.evaluate(() => audit.all())).toEqual([{
    userId: '00000000-0000-4000-8000-000000000002', syncId: 'audit-nutrition', revision: 'other-r1', status: 'conflict',
  }]);
});

test('a new revision or resolved status from another tab keeps the row', async ({ context }) => {
  const a = await auditTab(context);
  const b = await auditTab(context);
  await a.evaluate(() => audit.put());
  await b.evaluate(() => audit.put('r2'));
  expect(await a.evaluate(() => audit.accept())).toBe('stale-local');
  expect(await a.evaluate(async () => (await audit.all())[0].revision)).toBe('r2');
  await b.evaluate(() => audit.put('r1', 'pending'));
  expect(await a.evaluate(() => audit.accept())).toBe('stale-local');
  expect(await a.evaluate(async () => (await audit.all())[0].status)).toBe('pending');
});

test('abort after the delete request succeeded rolls back, rather than reporting success', async ({ context }) => {
  const a = await auditTab(context);
  await a.evaluate(() => audit.put());
  const outcome = await a.evaluate(async () => {
    const controller = new AbortController();
    const nativeDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) {
      const request = nativeDelete.apply(this, args);
      request.addEventListener('success', () => controller.abort(new Error('Synthetic account switch')), { once: true });
      return request;
    };
    try { return await audit.accept(controller.signal); }
    catch (error) { return error.message; }
    finally { IDBObjectStore.prototype.delete = nativeDelete; }
  });
  expect(outcome).toBe('Synthetic account switch');
  const b = await auditTab(context);
  expect(await b.evaluate(async () => (await audit.all())[0].revision)).toBe('r1');
  expect(await b.evaluate(() => audit.accept())).toBe('accepted-remote');
});
