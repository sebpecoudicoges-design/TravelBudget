import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { createMutationQueueStore, flushMutationQueue } from '../../src/data/mutationQueueStore.js';

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
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js','utf8'),{window,localStorage:storage,navigator:{language:'fr'},setTimeout(){},console});
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
  await flushMutationQueue({store,onSuccess,onPermanentFailure,isPermanentFailure:()=>outcome==='permanent',run:async item=>{
    expect(item.payload.amount).toBe(10);
    store.enqueue('update',{amount:20},{entityId:'one'});
    store.enqueue('update',{amount:30},{entityId:'one'});
    if(outcome!=='success') throw new Error('old failure');
  }});
  const next=reload();
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
  expect(store.isCurrentAttempt(first)).toBe(true);
  const second=store.beginAttempt('m1');
  expect(second.revision).toBe(first.revision);
  expect(store.isCurrentAttempt(first)).toBe(false);
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
  const window={Data:{createMutationQueueStore,flushMutationQueue},sbUser:{id:'synthetic'},addEventListener(){},dispatchEvent(){},toastOk(){},tbTripCleanupOfflineOptimistic:cleanup};
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline_queue.js','utf8'),{window,localStorage:storage,navigator:{language:'fr'},setTimeout(){},console});
  const enqueue=amount=>window.tbOfflineQueueEnqueue('trip.expense.update',{amount},{entityId:'trip-one'});
  const item=enqueue(10);
  window.tbTripReplayOfflineExpenseMutation=async()=>{enqueue(20);};
  await window.tbOfflineQueueSync('manual');
  expect(cleanup).not.toHaveBeenCalled();expect(window.tbOfflineQueueCount()).toBe(1);
  window.tbTripReplayOfflineExpenseMutation=async payload=>expect(payload.amount).toBe(20);
  await window.tbOfflineQueueSync('manual');
  expect(cleanup).toHaveBeenCalledExactlyOnceWith(item.id);expect(window.tbOfflineQueueCount()).toBe(0);
});
