import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { createMutationQueueStore, flushMutationQueue } from '../../src/data/mutationQueueStore.js';

it('keeps persisted Trip errors through startup timers until explicit cleanup', async () => {
  vi.useFakeTimers();
  try {
    const saved = { version: 4, items: [{ id: 'pending-trip', kind: 'trip.expense.update', status: 'pending', attempts: 1,
      error: 'violates foreign key constraint', payload: { amount: 10, members: [] }, meta: {} }] };
    const values = new Map([['travelbudget_offline_queue_v2_a', JSON.stringify(saved)]]);
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const cleanup = vi.fn();
    const window = { Data: { createMutationQueueStore, flushMutationQueue }, sbUser: { id: 'a' }, addEventListener() {}, dispatchEvent() {}, toastOk() {}, tbTripCleanupOfflineOptimistic: cleanup };
    vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), {
      window, localStorage: storage, navigator: { language: 'fr' }, setTimeout, setInterval, clearInterval, console,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(window.tbOfflineQueuePending()[0]).toMatchObject({ id: 'pending-trip', error: saved.items[0].error });
    expect(cleanup).not.toHaveBeenCalled();
    expect(window.tbOfflineQueueDiscardTripConflicts()).toHaveLength(1);
    expect(window.tbOfflineQueueCount()).toBe(0);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith('pending-trip');
  } finally { vi.useRealTimers(); }
});

it.each(['unavailable', 'rejected', 'account-change'])('does not bypass the browser lock when %s', async outcome => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const replay = vi.fn();
  const window = { Data: { createMutationQueueStore, flushMutationQueue }, sbUser: { id: 'a' }, addEventListener() {}, dispatchEvent() {}, toastOk() {}, tbTripReplayOfflineExpenseMutation: replay };
  const request = vi.fn(async (name, options, callback) => {
    expect(name).toBe('tb:offline-sync:travelbudget_offline_queue_v2_a');
    expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
    if (outcome === 'rejected') throw new Error('Lock manager denied');
    if (outcome === 'account-change') window.sbUser = { id: 'b' };
    return callback(outcome === 'unavailable' ? null : {});
  });
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), {
    window, localStorage: storage, navigator: { language: 'fr', locks: { request } }, setTimeout() {}, setInterval, clearInterval, console,
  });
  window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 10 }, {});
  const pending = window.tbOfflineQueueSync('manual');
  if (outcome === 'rejected') await expect(pending).rejects.toThrow('Lock manager denied');
  else expect(await pending).toMatchObject({ skipped: outcome === 'unavailable' ? 'locked' : 'account-change' });
  expect(replay).not.toHaveBeenCalled();
  window.sbUser = { id: 'a' };
  expect(window.tbOfflineQueueCount()).toBe(1);
});

it.each(['transaction.apply_v2', 'transaction.update_v2'])('retains the optimistic transaction after a database constraint failure: %s', async kind => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const rpc = vi.fn().mockRejectedValue(new Error('violates foreign key constraint'));
  const state = { transactions: [] };
  const window = { Data: { createMutationQueueStore, flushMutationQueue, supabaseRepository: { rpc } }, state,
    sbUser: { id: 'synthetic' }, addEventListener() {}, dispatchEvent() {}, toastOk() {} };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), {
    window, state, localStorage: storage, navigator: { language: 'fr' }, setTimeout() {}, setInterval, clearInterval, console,
  });
  const item = window.tbOfflineQueueEnqueue(kind, { args: { p_amount: 10 } }, {});
  state.transactions.push({ id: item.id, offlinePending: true, offlineQueueId: item.id });
  expect(await window.tbOfflineQueueSync('manual')).toMatchObject({ ok: false, failed: 1 });
  expect(state.transactions).toHaveLength(1);
  expect(window.tbOfflineQueuePending()[0].payload.args.p_amount).toBe(10);
  rpc.mockResolvedValue({});
  expect(await window.tbOfflineQueueSync('manual')).toMatchObject({ ok: true, synced: 1 });
  expect(state.transactions).toHaveLength(0);
  expect(window.tbOfflineQueueCount()).toBe(0);
});

it.each([
  'duplicate key value violates unique constraint',
  'violates foreign key constraint',
  'shares are empty',
  'Cette depense est deja liee',
])('preserves an unsuccessful replay instead of discarding it based on error text: %s', async message => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const cleanup = vi.fn();
  const window = { Data: { createMutationQueueStore, flushMutationQueue }, sbUser: { id: 'a' },
    addEventListener() {}, dispatchEvent() {}, toastOk() {}, tbTripCleanupOfflineOptimistic: cleanup,
    tbTripReplayOfflineExpenseMutation: async payload => { if (payload.amount === 10) throw new Error(message); } };
  const context = { window, localStorage: storage, navigator: { language: 'fr' }, setTimeout() {}, setInterval, clearInterval, console };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), context);
  const first = window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 10, members: ['synthetic'] }, { entityId: 'one' });
  const second = window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 20, members: ['synthetic'] }, { entityId: 'two' });
  const result = await window.tbOfflineQueueSync('manual');
  expect(result).toMatchObject({ ok: false, failed: 1, synced: 1 });
  expect(window.tbOfflineQueuePending()).toEqual([expect.objectContaining({ id: first.id, status: 'pending', error: message, payload: expect.objectContaining({ amount: 10 }) })]);
  expect(cleanup).toHaveBeenCalledExactlyOnceWith(second.id);
  const reloadWindow = { ...window, __TB_OFFLINE_QUEUE_V2_LOADED__: false, tbTripReplayOfflineExpenseMutation: async () => {} };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), { ...context, window: reloadWindow });
  expect(reloadWindow.tbOfflineQueuePending()[0].id).toBe(first.id);
  expect(await reloadWindow.tbOfflineQueueSync('manual')).toMatchObject({ ok: true, synced: 1 });
  expect(reloadWindow.tbOfflineQueueCount()).toBe(0);
  expect(cleanup).toHaveBeenLastCalledWith(first.id);
});

it.each(['remove', 'failed', 'kind', 'trip'])('keeps optimistic data until %s deletion is persisted', action => {
  const values = new Map();
  let fail = false;
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => {
    if (fail) throw new Error('Quota exceeded');
    values.set(key, value);
  }, removeItem: key => values.delete(key) };
  const state = { transactions: [] };
  const toast = vi.fn();
  const window = { Data: { createMutationQueueStore, flushMutationQueue }, state, sbUser: { id: 'a' },
    addEventListener() {}, dispatchEvent() {}, toastOk: toast };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), {
    window, state, localStorage: storage, navigator: { language: 'fr' }, setTimeout() {}, setInterval, clearInterval, console,
  });
  const item = window.tbOfflineQueueEnqueue('transaction.update_v2', { args: { p_trip_expense_id: 'trip' } }, {});
  const queueKey = 'travelbudget_offline_queue_v2_a';
  const saved = JSON.parse(values.get(queueKey));
  saved.items[0].error = 'duplicate key value';
  values.set(queueKey, JSON.stringify(saved));
  state.transactions.push({ id: item.id, localOnly: true, offlineQueueId: item.id });
  const remove = () => ({
    remove: () => window.tbOfflineQueueRemove(item.id),
    failed: () => window.tbOfflineQueueDiscardFailed(),
    kind: () => window.tbOfflineQueueDiscardKind('transaction.'),
    trip: () => window.tbOfflineQueueDiscardTripConflicts(),
  })[action]();
  toast.mockClear();
  fail = true;
  expect(remove).toThrow('Quota exceeded');
  expect(state.transactions).toHaveLength(1);
  expect(window.tbOfflineQueueCount()).toBe(1);
  expect(toast).not.toHaveBeenCalled();
  fail = false;
  remove();
  expect(state.transactions).toHaveLength(0);
  expect(window.tbOfflineQueueCount()).toBe(0);
});

it.each(['success', 'offline', 'lost', 'storage-error'])('cleans the renewal timer after %s and preserves queued work', async outcome => {
  vi.useFakeTimers();
  try {
    const values = new Map();
    let finish;
    let rejectStorage = false;
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => {
      if (rejectStorage && key.includes('_lock_')) throw new Error('Storage unavailable');
      values.set(key, value);
    }, removeItem: key => values.delete(key) };
    const replay = vi.fn(async () => {});
    const window = { Data: { createMutationQueueStore, flushMutationQueue }, sbUser: { id: 'a' },
      addEventListener() {}, dispatchEvent() {}, toastOk() {}, tbTripReplayOfflineExpenseMutation: replay,
      tbShouldUseOfflineMode: () => new Promise(resolve => { finish = resolve; }) };
    vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), {
      window, localStorage: storage, navigator: { language: 'fr' }, setTimeout() {}, setInterval, clearInterval, console,
    });
    window.tbOfflineQueueEnqueue('trip.expense.update', { amount: 10 }, { entityId: 'one' });
    const pending = window.tbOfflineQueueSync('manual');
    await vi.advanceTimersByTimeAsync(70_000);
    const lockKey = 'travelbudget_offline_queue_v2_lock_a';
    expect(JSON.parse(values.get(lockKey)).expiresAt).toBeGreaterThan(Date.now());
    if (outcome === 'lost') values.set(lockKey, JSON.stringify({ owner: 'replacement', expiresAt: Date.now() + 45_000 }));
    if (outcome === 'storage-error') rejectStorage = true;
    finish(outcome === 'offline');
    const result = await pending;
    expect(vi.getTimerCount()).toBe(0);
    expect(replay).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0);
    expect(window.tbOfflineQueueCount()).toBe(outcome === 'success' ? 0 : 1);
    if (outcome === 'lost' || outcome === 'storage-error') expect(result).toMatchObject({ ok: false, skipped: 'lock-lost' });
    if (outcome === 'lost') expect(JSON.parse(values.get(lockKey)).owner).toBe('replacement');
  } finally { vi.useRealTimers(); }
});

it('releases the acquired account lock after changing account',()=>{
  const values=new Map();let account='a';
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const store=createMutationQueueStore({storage,queueKey:()=>account,owner:'tab'});
  expect(store.acquireLock()).toBe(true);
  account='b';values.set('b_lock',JSON.stringify({owner:'other',expiresAt:Date.now()+45000}));
  store.releaseLock();expect(values.has('a_lock')).toBe(false);expect(JSON.parse(values.get('b_lock')).owner).toBe('other');
});

it.each(['online','offline','account-change'])('guards concurrent adapter starts during %s network preflight',async outcome=>{
  const values=new Map();let finish;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const replay=vi.fn(async()=>{});
  const window={Data:{createMutationQueueStore,flushMutationQueue},sbUser:{id:'a'},addEventListener(){},dispatchEvent(){},toastOk(){},tbTripReplayOfflineExpenseMutation:replay,
    tbShouldUseOfflineMode:vi.fn(()=>new Promise(resolve=>{finish=resolve;}))};
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js','utf8'),{window,localStorage:storage,navigator:{language:'fr'},setTimeout(){},setInterval,clearInterval,console});
  window.tbOfflineQueueEnqueue('trip.expense.update',{amount:10},{entityId:'one'});
  const first=window.tbOfflineQueueSync('manual');
  expect(await window.tbOfflineQueueSync('manual')).toMatchObject({skipped:'already-syncing'});
  expect(window.tbShouldUseOfflineMode).toHaveBeenCalledTimes(1);
  if(outcome==='account-change') {window.sbUser={id:'b'};window.tbOfflineQueueEnqueue('trip.expense.update',{amount:20},{entityId:'two'});}
  finish(outcome==='offline');await first;
  expect(replay).toHaveBeenCalledTimes(outcome==='online'?1:0);
  expect(values.has('travelbudget_offline_queue_v2_lock_a')).toBe(false);
  window.tbShouldUseOfflineMode=async()=>false;
  await window.tbOfflineQueueSync('manual');
  expect(window.tbOfflineQueueCount()).toBe(0);
});

function fixture(options={}) {
  const values=new Map(); let id=0;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const settings={storage,queueKey:'q',now:()=>1000,idFactory:()=>`m${++id}`,...options};
  return {store:createMutationQueueStore(settings),reload:()=>createMutationQueueStore(settings)};
}
it.each(['success','retry','permanent'])('preserves a newer persisted payload after old %s',async(outcome)=>{
  const {store,reload}=fixture();
  store.enqueue('update',{amount:10},{entityId:'one'});
  const onSuccess=vi.fn(),onPermanentFailure=vi.fn();
  const result=await flushMutationQueue({store,onSuccess,onPermanentFailure,isPermanentFailure:()=>outcome==='permanent',run:async item=>{
    expect(item.payload.amount).toBe(10);
    store.enqueue('update',{amount:20},{entityId:'one'});
    store.enqueue('update',{amount:30},{entityId:'one'});
    if(outcome!=='success') throw new Error('old failure');
  }});
  const next=reload();
  expect(result).toMatchObject({synced:0,failed:0,discarded:0,attempted:1});
  expect(next.read()).toHaveLength(1);
  expect(next.read()[0]).toMatchObject({payload:{amount:30},status:'pending',error:null,nextAttemptAt:null});
  expect(onSuccess).not.toHaveBeenCalled(); expect(onPermanentFailure).not.toHaveBeenCalled();
  const sent=[]; await flushMutationQueue({store:next,run:async item=>sent.push(item.payload.amount)});
  expect(sent).toEqual([30]); expect(next.count()).toBe(0);
});
it.each(['sport.sync_local','nutrition.sync_local'])('retains a new singleton request for %s',async kind=>{
  const {store}=fixture();store.enqueue(kind,{version:1},{},{singleton:true});
  await flushMutationQueue({store,run:async()=>{store.enqueue(kind,{version:2},{},{singleton:true});}});
  expect(store.read()).toHaveLength(1);expect(store.read()[0].payload.version).toBe(2);
});
it('does not replay an item removed while an earlier item was sending',async()=>{
  const {store}=fixture();store.enqueue('one');const second=store.enqueue('two').item;
  const run=vi.fn(async()=>store.remove(second.id));
  const result=await flushMutationQueue({store,run});
  expect(run).toHaveBeenCalledTimes(1);expect(result.attempted).toBe(1);
});
it('does not acknowledge or replay another account after a scope change',async()=>{
  let account='a';const {store}=fixture({queueKey:()=>account});
  store.enqueue('one');store.enqueue('two');const onSuccess=vi.fn();
  const run=vi.fn(async()=>{account='b';store.enqueue('other');});
  await flushMutationQueue({store,run,onSuccess});
  expect(run).toHaveBeenCalledTimes(1);expect(onSuccess).not.toHaveBeenCalled();
  expect(store.read().map(item=>item.kind)).toEqual(['other']);
  account='a';expect(store.count()).toBe(2);
});
it('retains an edit made during the success callback',async()=>{
  const {store}=fixture();store.enqueue('update',{amount:10},{entityId:'one'});
  await flushMutationQueue({store,run:async()=>{},onSuccess:async()=>{store.enqueue('update',{amount:20},{entityId:'one'});}});
  expect(store.read()[0].payload.amount).toBe(20);
});
it('distinguishes two attempts of the same revision after stale recovery',()=>{
  let clock=1000;const {store}=fixture({now:()=>clock});store.enqueue('update',{}, {entityId:'one'});
  const first=store.beginAttempt('m1');clock+=61000;
  expect(store.read()[0].attemptToken).toBe(first.attemptToken);
  const second=store.beginAttempt('m1');
  expect(second.revision).toBe(first.revision);
  expect(second.attemptToken).not.toBe(first.attemptToken);
  expect(store.remove('m1',first)).toBe(false);
  expect(store.markFailure('m1',new Error('old'),first)).toBeNull();
  expect(store.remove('m1',second)).toBe(true);
});
it('reads and sends persisted version-3 items without losing their payload',async()=>{
  const old={version:3,items:[{id:'old',kind:'update',payload:{amount:10},meta:{entityId:'one'},status:'pending',attempts:0}]};
  let saved=JSON.stringify(old);
  const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
  const store=createMutationQueueStore({storage,queueKey:'q'});
  const run=vi.fn(async item=>expect(item.payload.amount).toBe(10));
  await flushMutationQueue({store,run});
  expect(run).toHaveBeenCalledTimes(1);expect(store.count()).toBe(0);
  expect(JSON.parse(saved).version).toBe(4);
});
it('keeps Trip optimistic state until its latest revision is acknowledged by the real adapter',async()=>{
  const values=new Map(),cleanup=vi.fn();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const window={Data:{createMutationQueueStore,flushMutationQueue},sbUser:{id:'synthetic'},addEventListener(){},dispatchEvent(){},toastOk:vi.fn(),tbTripCleanupOfflineOptimistic:cleanup};
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js','utf8'),{window,localStorage:storage,navigator:{language:'fr'},setTimeout(){},setInterval,clearInterval,console});
  const enqueue=amount=>window.tbOfflineQueueEnqueue('trip.expense.update',{amount},{entityId:'trip-one'});
  const item=enqueue(10);
  window.tbTripReplayOfflineExpenseMutation=async()=>{enqueue(20);window.toastOk.mockClear();};
  expect(await window.tbOfflineQueueSync('manual')).toMatchObject({synced:0,failed:0});
  expect(cleanup).not.toHaveBeenCalled();expect(window.tbOfflineQueueCount()).toBe(1);
  expect(window.toastOk).not.toHaveBeenCalled();
  window.tbTripReplayOfflineExpenseMutation=async payload=>expect(payload.amount).toBe(20);
  await window.tbOfflineQueueSync('manual');
  expect(cleanup).toHaveBeenCalledExactlyOnceWith(item.id);expect(window.tbOfflineQueueCount()).toBe(0);
});

it.each([
  ['sport', 'tbSportSyncLocalWorkouts'],
  ['nutrition', 'tbNutritionSyncLocal'],
])('keeps %s intent until its lazy handler is available and never starts it for a new account', async (domain, adapter) => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const replay = vi.fn(async () => {});
  const window = { Data: { createMutationQueueStore, flushMutationQueue }, sbUser: { id: 'first' },
    addEventListener() {}, dispatchEvent() {}, toastOk: vi.fn(), tbLoadLegacyDomain: vi.fn(async () => {}) };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), {
    window, localStorage: storage, navigator: { language: 'fr' }, setTimeout() {}, setInterval, clearInterval,
    console: { warn() {} },
  });
  const original = window.tbOfflineQueueEnqueue(`${domain}.sync_local`);
  window.toastOk.mockClear();
  expect(await window.tbOfflineQueueSync('manual')).toMatchObject({ ok: false, failed: 1, synced: 0 });
  expect(window.tbLoadLegacyDomain).toHaveBeenCalledWith(domain);
  expect(window.tbOfflineQueuePending()[0]).toMatchObject({ id: original.id, status: 'pending', error: expect.stringContaining('indisponible') });
  expect(window.toastOk).not.toHaveBeenCalled();
  window.tbLoadLegacyDomain.mockImplementation(async () => {
    window[adapter] = replay;
    window.sbUser = { id: 'second' };
  });
  expect(await window.tbOfflineQueueSync('manual')).toMatchObject({ ok: false, skipped: 'account-change', synced: 0 });
  expect(replay).not.toHaveBeenCalled();
  expect(window.tbOfflineQueueCount()).toBe(0);
  window.sbUser = { id: 'first' };
  expect(window.tbOfflineQueuePending()[0].id).toBe(original.id);
});

it.each(['same-intent', 'newer-revision', 'account-change'])('replays a cold Trip action only when still current: %s', async scenario => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const send = vi.fn(async () => {});
  const window = {
    Data: { createMutationQueueStore, flushMutationQueue }, sbUser: { id: 'a' }, toastOk() {},
    addEventListener() {}, dispatchEvent() {},
    tbLoadLegacyDomain: vi.fn(async () => {
      if (scenario === 'newer-revision') enqueue(20);
      if (scenario === 'account-change') window.sbUser = { id: 'b' };
      window.tbTripReplayOfflineExpenseMutation = send;
    }),
  };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8'), {
    window, localStorage: storage, navigator: { language: 'fr' }, setTimeout() {}, setInterval, clearInterval, console,
  });
  const enqueue = amount => window.tbOfflineQueueEnqueue('trip.expense.update', { amount }, { entityId: 'expense-1' });
  enqueue(10);
  const result = await window.tbOfflineQueueSync('manual');
  expect(window.tbLoadLegacyDomain).toHaveBeenCalledExactlyOnceWith('trip');
  if (scenario === 'same-intent') {
    expect(result).toMatchObject({ ok: true, synced: 1 });
    expect(send).toHaveBeenCalledExactlyOnceWith({ mode: 'update', amount: 10 }, expect.any(Function));
    expect(window.tbOfflineQueueCount()).toBe(0);
  } else {
    expect(send).not.toHaveBeenCalled();
    window.sbUser = { id: 'a' };
    expect(window.tbOfflineQueuePending()[0].payload.amount).toBe(scenario === 'newer-revision' ? 20 : 10);
    if (scenario === 'account-change') {
      // Simulate the original scope's abandoned attempt aging past the recovery window.
      const key = 'travelbudget_offline_queue_v2_a';
      const snapshot = JSON.parse(values.get(key));
      snapshot.items[0].updatedAt = new Date(Date.now() - 61_000).toISOString();
      values.set(key, JSON.stringify(snapshot));
    }
    expect(await window.tbOfflineQueueSync('manual')).toMatchObject({ ok: true, synced: 1 });
    expect(send).toHaveBeenCalledOnce();
  }
});

it.each(['load', 'fingerprint'])('does not write a Trip replay after its intent changes during %s', async boundary => {
  const source = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
  const code = source.slice(source.indexOf('async function _tripReplayOfflineExpenseMutation'), source.indexOf('window.tbTripReplayOfflineExpenseMutation ='));
  let allowed = true;
  const context = {
    sbUser: { id: 'first' },
    tripState: { activeTripId: 'trip', members: [] },
    _loadActiveData: async () => { if (boundary === 'load') allowed = false; },
    _findExistingTripExpenseForReplay: async () => { allowed = false; return 'similar-expense'; },
    _tripExpenseFormForQueue: form => form,
    _addExpense: vi.fn(), _updateExpense: vi.fn(), console,
  };
  vm.runInNewContext(code, context);
  await expect(context._tripReplayOfflineExpenseMutation({ tripId: 'trip', form: {} }, () => allowed)).rejects.toThrow('interrompue');
  expect(context._addExpense).not.toHaveBeenCalled();
  expect(context._updateExpense).not.toHaveBeenCalled();
  expect(context.tripState._offlineReplaySaving).toBe(false);
});
