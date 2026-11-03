import { test, expect } from '@playwright/test';

for(const outcome of ['success','retry','permanent']) test(`new offline revision survives old ${outcome} and reload`,async({page})=>{
  await page.route('**/queue-revision-test',route=>route.fulfill({contentType:'text/html',body:'<html><body>Queue persistence test</body></html>'}));
  await page.goto('/queue-revision-test');
  await page.evaluate(async outcome=>{
    const {createMutationQueueStore,flushMutationQueue}=await import('/src/data/mutationQueueStore.js');
    const store=createMutationQueueStore({storage:localStorage,queueKey:'test-queue'});
    store.enqueue('update',{amount:10},{entityId:'one'});
    let release;
    const pending=new Promise(resolve=>{release=resolve;});
    const sending=flushMutationQueue({store,isPermanentFailure:()=>outcome==='permanent',run:async item=>{
      window.sent=[item.payload.amount];await pending;
      if(outcome!=='success')throw new Error('first failed');
    }});
    store.enqueue('update',{amount:20},{entityId:'one'});
    release();await sending;
  },outcome);
  expect(await page.evaluate(()=>window.sent)).toEqual([10]);
  await page.reload();
  const result=await page.evaluate(async()=>{
    const {createMutationQueueStore,flushMutationQueue}=await import('/src/data/mutationQueueStore.js');
    const store=createMutationQueueStore({storage:localStorage,queueKey:'test-queue'});
    const before=store.read();const sent=[];
    await flushMutationQueue({store,run:async item=>sent.push(item.payload.amount)});
    return {before,sent,remaining:store.count()};
  });
  expect(result.before).toHaveLength(1);
  expect(result.before[0]).toMatchObject({payload:{amount:20},status:'pending'});
  expect(result.sent).toEqual([20]);expect(result.remaining).toBe(0);
});
