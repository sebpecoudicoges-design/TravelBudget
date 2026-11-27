// Optional end-to-end extension of the local REST harness. The browser receives
// only synthetic rows from a fixed Node callback; no auth token or server URL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';

export async function verifyConflictInBrowser({ executablePath, pending, replay, readRemote, editRemote }) {
  const fixtureOrigin = 'http://127.0.0.1:41871';
  const browser = await chromium.launch({ executablePath });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 820 } });
    const assets = new Map();
    for (const path of ['meal-conflict-review.mjs', 'atomic-meal-conflict.mjs', 'local-conflict-store.mjs',
      'meal-conflict-review.css']) {
      assets.set('/' + path, await readFile(new URL(path, import.meta.url)));
    }
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== fixtureOrigin || route.request().method() !== 'GET') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html',
        body: '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/meal-conflict-review.css"><main data-meal-conflict-audit></main>' });
      const body = assets.get(url.pathname);
      if (!body) return route.abort();
      return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body });
    });
    const page = await context.newPage();
    await page.exposeFunction('readSyntheticMeal', () => readRemote()); // no selectable query or credentials
    await page.goto(fixtureOrigin);
    await page.evaluate(async ({ pending, replay }) => {
      const { mountMealConflictReview } = await import('/meal-conflict-review.mjs');
      const { prepareMealConflict, resolveMealConflict } = await import('/atomic-meal-conflict.mjs');
      const { auditConflictStore, removeReviewedMealConflict } = await import('/local-conflict-store.mjs');
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('audit-only', 1);
        req.onupgradeneeded = () => req.result.createObjectStore(auditConflictStore, { keyPath: ['userId', 'syncId'] });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const transact = (mode, action) => new Promise((resolve, reject) => {
        const tx = db.transaction(auditConflictStore, mode);
        const req = action(tx.objectStore(auditConflictStore));
        tx.oncomplete = () => resolve(req.result);
        tx.onabort = () => reject(tx.error);
      });
      const local = { header: { label: 'Synthetic local dinner', water_ml: 150 }, items: [{ label: 'Rice', grams: 81 }] };
      await transact('readwrite', store => store.add({ ...pending, status: 'conflict', snapshot: local }));
      window.readSyntheticDraft = () => transact('readonly', store => store.get([pending.userId, pending.syncId]));
      const contextCurrent = review => review.userId === pending.userId && review.syncId === pending.syncId;
      await mountMealConflictReview(document.querySelector('main'), {
        locale: 'en',
        load: async () => {
          const [remote, draft] = await Promise.all([window.readSyntheticMeal(), window.readSyntheticDraft()]);
          return { preview: prepareMealConflict({ pending: draft, remote, replay }),
            local: draft.snapshot, remote: remote.snapshot };
        },
        resolve: (preview, choice) => resolveMealConflict({
          preview, choice, contextCurrent, readRemote: () => window.readSyntheticMeal(),
          removeLocalIfCurrent: reviewed => removeReviewedMealConflict({ db, reviewed, contextCurrent }),
        }),
      });
    }, { pending, replay });
    const keep = page.getByRole('radio', { name: 'Leave my draft pending' });
    const accept = page.getByRole('radio', { name: 'Keep the synced version' });
    const confirm = page.getByRole('button', { name: 'Confirm choice' });
    const status = page.getByRole('status');
    await expect(keep).toBeChecked();
    await confirm.click();
    await expect(status).toHaveText('Your draft stays pending.');
    assert.equal(await page.evaluate(async () => (await window.readSyntheticDraft()).revision), pending.revision);

    const before = await readRemote();
    await editRemote(before);
    await accept.check();
    await confirm.click();
    await expect(status).toContainText('Refresh the comparison');
    assert.equal(await page.evaluate(async () => (await window.readSyntheticDraft()).revision), pending.revision);

    await page.getByRole('button', { name: 'Refresh comparison' }).click();
    await expect(keep).toBeChecked();
    await expect(page.getByRole('listitem').last()).toContainText('96 g');
    const reviewed = await readRemote();
    assert.notEqual(reviewed.revision, before.revision);
    await accept.check();
    await confirm.click();
    await expect(status).toHaveText('Synced version kept. Local draft removed.');
    assert.equal(await page.evaluate(() => window.readSyntheticDraft()), undefined);
    assert.deepEqual(await readRemote(), reviewed, 'browser acceptance changes only IndexedDB');
  } finally {
    await browser.close();
  }
}
