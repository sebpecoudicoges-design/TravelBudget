import { it, expect } from 'vitest';
import { readPages, readSettings, saveSettings, settingsKey, loadAccountingData } from '../../../src/features/accounting/accountingData.js';

it('reads every page in stable ID order and propagates errors without partial success', async () => {
  const ordered = [];
  const rows = Array.from({ length: 1101 }, (_, id) => ({ id }));
  expect(await readPages(() => ({ order: key => { ordered.push(key); return { range: async (from, to) => ({ data: rows.slice(from, to + 1) }) }; } }))).toHaveLength(1101);
  expect(ordered).toEqual(['id', 'id', 'id']);
  await expect(readPages(() => ({ order: () => ({ range: async () => ({ error: new Error('unavailable') }) }) }))).rejects.toThrow('unavailable');
});
it('isolates local configuration per account and travel and reports storage failures', () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  saveSettings(storage, 'alice', 'trip', { mapping: { x: '601' } });
  expect(readSettings(storage, 'alice', 'trip')).toEqual({ mapping: { x: '601' } });
  expect(readSettings(storage, 'bob', 'trip')).toEqual({});
  expect(readSettings(storage, 'alice', 'other')).toEqual({});
  entries.set(settingsKey('alice', 'trip'), '{invalid');
  expect(readSettings(storage, 'alice', 'trip')).toEqual({});
  expect(() => saveSettings({ setItem() { throw new Error('full'); } }, 'alice', 'trip', {})).toThrow('full');
});
it('requires a signed-in identity and travel before requesting data', async () => {
  await expect(loadAccountingData({ client: {}, userId: '', travelId: 'x' })).rejects.toThrow();
});
