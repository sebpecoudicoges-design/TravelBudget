// Audit diagnostics only. Uses in-memory storage, no server writes.
// Run from repository root: node .codex/audits/2026-10-10/reproduce.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import { createMutationQueueStore, flushMutationQueue } from '../../../src/data/mutationQueueStore.js';
import { saveLocalNutritionRowsOnce, loadLocalNutritionRows, saveLocalNutritionRows } from '../../../src/data/nutritionRepository.js';

const values = new Map();
const storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
const queue = createMutationQueueStore({ storage, queueKey: 'audit', idFactory: () => 'a' });
queue.enqueue('transaction.update', { amount: 10 }, { entityId: 'tx1' });
const sent = [];
await flushMutationQueue({ store: queue, run: async item => {
  sent.push(item.payload.amount);
  queue.enqueue('transaction.update', { amount: 20 }, { entityId: 'tx1' });
} });
console.log('Queue: expected pending amount 20 after sending 10', { sent, remaining: queue.read() });

const rows = Array.from({ length: 201 }, (_, i) => ({ syncId: String(i), synced: false }));
const returned = saveLocalNutritionRowsOnce({ storage, key: 'nutrition', rows });
console.log('Nutrition: expected all pending rows persisted', { returned: returned.length, persisted: loadLocalNutritionRows({ storage, key: 'nutrition' }).length });
globalThis.window = { localStorage: storage, tbSafeLocalStorageSet: () => ({ ok: false, error: Error('quota') }) };
console.log('Nutrition: expected false on failed write', { reportedSuccess: saveLocalNutritionRows({ storage, key: 'quota', rows: [rows[0]] }), persisted: storage.getItem('quota') || null });
delete globalThis.window;

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('  window.tbLoadLegacyDomain = function');
const end = source.indexOf('  window.tbEnsureCashflowCurve', start);
let attempts = 0;
const context = { window: {}, LEGACY_DOMAIN_SCRIPTS: { trip: ['trip.js'] }, legacyDomainPromises: new Map(),
  waitForBridgeReady: async () => {}, ensureDomainModules: async () => {}, ensureAnalysisModules: async () => {},
  loadScript: async () => { attempts++; throw Error('offline'); } };
vm.runInNewContext(source.slice(start, end), context);
await context.window.tbLoadLegacyDomain('trip').catch(() => {});
await context.window.tbLoadLegacyDomain('trip').catch(() => {});
console.log('Loader: expected two attempts and loaded=false', { attempts, reportedLoaded: context.window.tbIsLegacyDomainLoaded('trip') });
