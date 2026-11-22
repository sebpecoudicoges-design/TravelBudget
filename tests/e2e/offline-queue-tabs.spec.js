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
  await first.evaluate(() => {
    window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 10 }, { entityId: 'one' });
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
