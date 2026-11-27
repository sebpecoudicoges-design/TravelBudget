import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareMealConflict, resolveMealConflict } from './atomic-meal-conflict.mjs';

const userId = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const mealId = '00000000-0000-4000-8000-000000000003';
const syncId = 'nutrition_offline_a';
const pending = { userId, syncId, revision: 'local-r1' };
const remote = { userId, syncId, mealId, revision: 'whole-meal-r1' };
const replay = { mealId, status: 'conflict', disposition: 'pending' };
const preview = prepareMealConflict({ pending, remote, replay });
const forbidden = () => assert.fail('Unexpected read or local mutation');

test('keep pending by default, and reject unknown choices', async () => {
  const args = { preview, contextCurrent: forbidden, readRemote: forbidden, removeLocalIfCurrent: forbidden };
  assert.equal(await resolveMealConflict(args), 'pending');
  assert.equal(await resolveMealConflict({ ...args, choice: 'keep-pending' }), 'pending');
  await assert.rejects(resolveMealConflict({ ...args, choice: 'overwrite' }), /Unknown/);
});

test('prepare only the exact conflict and a complete revision', () => {
  for (const input of [
    { pending, remote, replay: { ...replay, status: 'already_applied' } },
    { pending, remote: { ...remote, mealId: other }, replay },
    { pending, remote: { ...remote, userId: other }, replay },
    { pending, remote: { ...remote, revision: undefined }, replay },
    { pending: { ...pending, revision: '' }, remote, replay },
  ]) assert.throws(() => prepareMealConflict(input), /could not be confirmed/);
  assert.equal(Object.isFrozen(preview), true);
});

const resolve = overrides => resolveMealConflict({
  choice: 'accept-remote', preview, contextCurrent: () => true,
  readRemote: async () => remote, removeLocalIfCurrent: forbidden, ...overrides,
});

test('accept remote removes only the reviewed local entry, at most once', async () => {
  const nextRow = { userId, syncId: 'unrelated', revision: 'other' };
  const rows = [{ ...pending, status: 'conflict' }, nextRow];
  const removeLocalIfCurrent = async expected => {
    const index = rows.findIndex(entry => entry.userId === expected.userId && entry.syncId === expected.syncId
      && entry.revision === expected.localRevision && entry.status === 'conflict');
    if (index < 0) return false;
    rows.splice(index, 1);
    return true;
  };
  const readRemote = async requested => {
    assert.deepEqual(requested, { userId, syncId, mealId });
    return remote;
  };
  assert.equal(await resolve({ readRemote, removeLocalIfCurrent }), 'accepted-remote');
  assert.equal(await resolve({ readRemote, removeLocalIfCurrent }), 'stale-local');
  assert.deepEqual(rows, [nextRow]);
});

test('missing, changed, or unreadable remote never drops the draft', async () => {
  for (const result of [null, { ...remote, revision: 'different' }, { ...remote, mealId: other },
    { ...remote, syncId: 'different' }, { ...remote, userId: other }]) {
    assert.equal(await resolve({ readRemote: async () => result }), 'refresh-preview');
  }
  await assert.rejects(resolve({ readRemote: async () => { throw new Error('Read failed'); } }), /Read failed/);
});

test('account switch while reading or a simultaneous local edit keeps the draft', async () => {
  assert.equal(await resolve({ contextCurrent: () => false, readRemote: forbidden }), 'stale-local');
  let active = true;
  assert.equal(await resolve({
    contextCurrent: () => active, readRemote: async () => { active = false; return remote; },
  }), 'stale-local');

  let stored = { ...pending, status: 'conflict' };
  assert.equal(await resolve({
    removeLocalIfCurrent: async expected => {
      // The other tab's transaction won even though the current tab was still active.
      stored = { ...stored, revision: 'local-new' };
      assert.notEqual(stored.revision, expected.localRevision);
      return false;
    },
  }), 'stale-local');
  assert.equal(stored.revision, 'local-new');
});

test('a storage failure cannot be reported as accepted', async () => {
  await assert.rejects(resolve({ removeLocalIfCurrent: async () => { throw new Error('Storage failed'); } }), /Storage failed/);
  assert.equal(await resolve({ removeLocalIfCurrent: async () => undefined }), 'stale-local');
});
