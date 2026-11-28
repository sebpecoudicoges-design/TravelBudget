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

export async function verifyDeletedDraftInBrowser({ executablePath, userId, syncId, replay, draft }) {
  const browser = await chromium.launch({ executablePath });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 820 } });
    const origin = 'http://127.0.0.1:41872';
    const script = await readFile(new URL('local-conflict-store.mjs', import.meta.url));
    const review = await readFile(new URL('meal-conflict-review.mjs', import.meta.url));
    const css = await readFile(new URL('meal-conflict-review.css', import.meta.url));
    await context.route('**/*', route => {
      if (route.request().method() !== 'GET') return route.abort();
      const url = route.request().url();
      if (url === origin + '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local fixture</title><link rel="stylesheet" href="/review.css"><main data-meal-conflict-audit></main>' });
      if (url === origin + '/review.mjs') return route.fulfill({ contentType: 'text/javascript', body: review });
      if (url === origin + '/review.css') return route.fulfill({ contentType: 'text/css', body: css });
      if (url === origin + '/store.mjs') return route.fulfill({ contentType: 'text/javascript', body: script });
      return route.abort();
    });
    const page = await context.newPage();
    const open = async () => {
      await page.goto(origin);
      await page.evaluate(async () => {
        const api = await import('/store.mjs');
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open('audit-deleted-draft', 1);
          req.onupgradeneeded = () => req.result.createObjectStore(api.auditConflictStore, { keyPath: ['userId', 'syncId'] });
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        window.fixture = { api, db, transact: (mode, act) => new Promise((resolve, reject) => {
          const tx = db.transaction(api.auditConflictStore, mode);
          const req = act(tx.objectStore(api.auditConflictStore));
          tx.oncomplete = () => resolve(req.result);
          tx.onabort = () => reject(tx.error);
        }) };
      });
    };
    const entry = { userId, syncId, revision: 'synthetic-r1', status: 'pending', snapshot: draft };
    await open();
    assert.deepEqual(await page.evaluate(async ({ entry, replay }) => {
      const { api, db, transact } = window.fixture;
      const { userId, syncId } = entry;
      await transact('readwrite', store => store.add(entry));
      const reviewed = { userId, syncId, localRevision: entry.revision };
      const options = { db, reviewed, replay, contextCurrent: () => true };
      const stale = await api.recordDeletedMealConflict({ ...options, reviewed: { ...reviewed, localRevision: 'stale' } });
      const wrongContext = await api.recordDeletedMealConflict({ ...options, contextCurrent: () => false });
      const marked = await api.recordDeletedMealConflict(options);
      const removed = await api.removeReviewedMealConflict(options);
      return { stale, wrongContext, marked, removed };
    }, { entry, replay }), { stale: false, wrongContext: false, marked: true, removed: false });
    await open();
    const stored = await page.evaluate(({ userId, syncId }) => window.fixture.transact('readonly', store => store.get([userId, syncId])), entry);
    assert.deepEqual(stored, { ...entry, status: 'deleted-conflict' });
    for (const [locale, heading, retained] of [
      ['fr', 'Repas supprimé', 'Ta saisie est conservée'],
      ['en', 'Meal deleted', 'Your draft is still on this device'],
    ]) {
      await page.evaluate(async ({ userId, syncId, locale }) => {
        const { mountMealConflictReview } = await import('/review.mjs');
        await mountMealConflictReview(document.querySelector('main'), {
          locale,
          load: async () => ({ entry: await window.fixture.transact('readonly', store => store.get([userId, syncId])) }),
          resolve: () => { throw new Error('A deleted-draft notice must not have a write action'); },
        });
      }, { ...entry, locale });
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole('status')).toContainText(retained);
      await expect(page.getByText(draft.header.label, { exact: false })).toBeVisible();
      await expect(page.getByRole('radio')).toHaveCount(0);
      await expect(page.getByRole('button')).toHaveCount(0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    }
    assert.deepEqual(await page.evaluate(({ userId, syncId }) => window.fixture.transact('readonly', store => store.get([userId, syncId])), entry), stored);
    await page.evaluate(async entry => {
      const { mountMealConflictReview } = await import('/review.mjs');
      await mountMealConflictReview(document.querySelector('main'), {
        locale: 'en',
        load: async () => ({ entry }), // pending on this device; no confirmed remote state
        resolve: () => { throw new Error('Missing remote data must not enable a write action'); },
      });
    }, entry);
    await expect(page.getByRole('heading', { level: 1, name: 'Compare meal versions' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Could not verify the versions. No removal was confirmed.');
    await expect(page.getByRole('radio')).toHaveCount(0);


  } finally {
    await browser.close();
  }
}
