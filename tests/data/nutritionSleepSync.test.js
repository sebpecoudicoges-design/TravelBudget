import { expect, it, vi } from 'vitest';
import { loadSleepRows, visibleSleepRows } from '../../src/data/nutritionRepository.js';
import { flushSleepDrafts, mergeSleepSnapshot, persistSleepDraft, saveSleepDraft } from '../../src/data/nutritionSleepRepository.js';

const day = '2026-11-24';
const otherDate = '2026-11-25';
const known = '2026-11-24T03:00:00Z';
const edited = '2026-11-25T03:00:00Z';
const server = { hours: 7, quality: 'ok', updatedAt: known };
const memory = rows => {
  const data = new Map(Object.entries(rows).map(([key, value]) => [key, JSON.stringify(value)]));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const writeDraft = (storage, hours, id, extra = {}) => saveSleepDraft({
  storage, key: 'sleep', day, hours, quality: 'ok', now: () => new Date(edited), id: () => id, ...extra,
});
const broker = () => {
  const queues = new Map();
  return { request: (name, callback) => {
    const next = (queues.get(name) || Promise.resolve()).catch(() => {}).then(callback);
    queues.set(name, next);
    return next;
  } };
};
it('preserves both days when two compatible views save around a remote refresh', async () => {
  const storage = memory({ sleep: { [day]: server } });
  const locks = broker();
  await Promise.all([
    writeDraft(storage, 8, 'first', { locks }),
    mergeSleepSnapshot({ storage, key: 'sleep', rows: { [day]: server }, locks }),
    writeDraft(storage, 6, 'second', { locks, day: otherDate }),
  ]);
  expect(loadSleepRows({ storage, key: 'sleep' })).toMatchObject({
    [day]: { hours: 8, pending: true, writeId: 'first' },
    [otherDate]: { hours: 6, pending: true, writeId: 'second' },
  });
});
it('does not resurrect a deleted night during retry or after a stale refresh', async () => {
  const storage = memory({ sleep: { [day]: server } });
  await writeDraft(storage, 0, 'delete');
  await expect(flushSleepDrafts({ storage, key: 'sleep', write: async () => { throw new Error('offline'); } })).rejects.toThrow('offline');
  await mergeSleepSnapshot({ storage, key: 'sleep', rows: { [day]: server } });
  expect(visibleSleepRows(loadSleepRows({ storage, key: 'sleep' }))).toEqual({});
  await flushSleepDrafts({ storage, key: 'sleep', write: async () => edited });
  await mergeSleepSnapshot({ storage, key: 'sleep', rows: { [day]: server } });
  expect(loadSleepRows({ storage, key: 'sleep' })[day]).toMatchObject({ deleted: true });
  expect(visibleSleepRows(loadSleepRows({ storage, key: 'sleep' }))).toEqual({});
});
it('a slow acknowledgement does not erase a subsequent local edit', async () => {
  const storage = memory({ sleep: { [day]: server } });
  const locks = broker();
  await writeDraft(storage, 8, 'first', { locks });
  const started = Promise.withResolvers();
  const reply = Promise.withResolvers();
  const sending = flushSleepDrafts({ storage, key: 'sleep', locks, write: async () => {
    started.resolve(); return reply.promise;
  } });
  await started.promise;
  await writeDraft(storage, 9, 'second', { locks });
  reply.resolve(edited);
  await sending;
  expect(loadSleepRows({ storage, key: 'sleep' })[day]).toMatchObject({
    hours: 9, pending: true, writeId: 'second', base: { hours: 8, updatedAt: edited },
  });
});
it('stops without recording an acknowledgement when the active account changes', async () => {
  const storage = memory({ sleep: { [day]: server }, other: { [day]: server } });
  let active = true;
  await writeDraft(storage, 8, 'first');
  await flushSleepDrafts({ storage, key: 'sleep', isCurrent: () => active, write: async () => {
    active = false; return edited;
  } });
  expect(loadSleepRows({ storage, key: 'sleep' })[day].pending).toBe(true);
  expect(loadSleepRows({ storage, key: 'other' })[day]).toEqual(server);
});
function serverClient(row, written) {
  const read = { select: () => read, eq: () => read, maybeSingle: async () => ({ data: row }) };
  const match = vi.fn(() => write);
  const write = { eq: match, select: () => write, maybeSingle: async () => ({ data: written }) };
  const client = { from: vi.fn().mockReturnValueOnce(read).mockReturnValue({ update: () => write }) };
  return { client, match };
}
it('treats a competing remote edit as a conflict without writing', async () => {
  const { client, match } = serverClient({ hours: 9, quality: 'ok', updated_at: '2026-11-25T01:00:00Z' });
  await expect(persistSleepDraft({ client, table: 'sleep', userId: 'u', day, row: {
    hours: 8, quality: 'ok', updatedAt: edited, base: server,
  } })).rejects.toMatchObject({ code: 'NUTRITION_SLEEP_CONFLICT' });
  expect(match).not.toHaveBeenCalled();
});
it('does not overwrite a change made between the remote read and the conditional update', async () => {
  const { client, match } = serverClient({ ...server, updated_at: known }, null);
  await expect(persistSleepDraft({ client, table: 'sleep', userId: 'u', day, row: {
    hours: 8, quality: 'ok', updatedAt: edited, base: server,
  } })).rejects.toMatchObject({ code: 'NUTRITION_SLEEP_CONFLICT' });
  expect(match).toHaveBeenCalledWith('updated_at', known);
});
