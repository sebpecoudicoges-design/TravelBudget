import {afterEach,describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

function harness(fetch = vi.fn().mockResolvedValue({status:200})) {
  const classes=new Set();
  const navigator={onLine:true};
  const window={SUPABASE_URL:'https://example.test',dispatchEvent:vi.fn(),location:{hash:'',search:''}};
  const context={window,navigator,fetch,Date,AbortController,URLSearchParams,setTimeout,clearTimeout,console,
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}},
    document:{documentElement:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}}}};
  vm.runInNewContext(fs.readFileSync('public/legacy/js/00_offline.js','utf8'),context);
  return {window,navigator,fetch,context};
}
afterEach(()=>vi.useRealTimers());
describe('network reachability on weak connections',()=>{
  it('can start probing after configuration becomes available',async()=>{
    const h=harness();h.window.SUPABASE_URL='';
    expect(await h.window.tbIsSupabaseReachable('early')).toBe(true);
    h.window.SUPABASE_URL='https://example.test';
    expect(await h.window.tbIsSupabaseReachable('configured')).toBe(true);
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });
  it('coalesces concurrent checks and retries after the positive cache expires',async()=>{
    vi.useFakeTimers();
    const h=harness();
    expect(await Promise.all([h.window.tbIsSupabaseReachable(),h.window.tbIsSupabaseReachable()])).toEqual([true,true]);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30001);
    expect(await h.window.tbIsSupabaseReachable()).toBe(true);
    expect(h.fetch).toHaveBeenCalledTimes(2);
  });
  it('accepts a slow successful connection and reuses it for subsequent actions',async()=>{
    vi.useFakeTimers();
    const fetch=vi.fn(()=>new Promise(resolve=>setTimeout(()=>resolve({status:200}),6000)));
    const h=harness(fetch); const pending=h.window.tbShouldUseOfflineMode('boot');
    await vi.advanceTimersByTimeAsync(3000); expect(h.window.tbIsOfflineMode()).toBe(false);
    await vi.advanceTimersByTimeAsync(3000); expect(await pending).toBe(false);
    expect(await h.window.tbShouldUseOfflineMode('transaction')).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('confirms two failed probes before blocking independent requests',async()=>{
    vi.useFakeTimers();
    const fetch=vi.fn((_,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('timeout')))));
    const h=harness(fetch); const pending=h.window.tbShouldUseOfflineMode('boot');
    await vi.advanceTimersByTimeAsync(10000); expect(h.window.tbIsOfflineMode()).toBe(false);
    await vi.advanceTimersByTimeAsync(10000); expect(await pending).toBe(true);
    expect(h.window.tbIsOfflineMode()).toBe(true); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('recovers a transient failure without declaring offline',async()=>{
    const h=harness(vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({status:200}));
    expect(await h.window.tbShouldUseOfflineMode('boot')).toBe(false);
    expect(h.window.tbIsOfflineMode()).toBe(false);
    expect(h.window.dispatchEvent).not.toHaveBeenCalled();
  });
  it('does not let an older failed probe override a newer successful request',async()=>{
    let reject; const h=harness(vi.fn(()=>new Promise((_,r)=>{reject=r;})));
    const pending=h.window.tbIsSupabaseReachable('check');
    h.window.tbClearNetworkUnavailable(); reject(new Error('network'));
    expect(await pending).toBe(true); expect(h.window.tbIsOfflineMode()).toBe(false);
  });
  it('uses device offline immediately and can recheck when network returns',async()=>{
    const h=harness();h.navigator.onLine=false;
    expect(await h.window.tbShouldUseOfflineMode('boot')).toBe(true);
    expect(h.fetch).not.toHaveBeenCalled();h.navigator.onLine=true;
    expect(await h.window.tbShouldUseOfflineMode('resume')).toBe(false);
  });
  it('keeps a confirmed outage until a forced recovery probe succeeds',async()=>{
    const h=harness(vi.fn().mockRejectedValue(new Error('network')));
    await h.window.tbIsSupabaseReachable('check'); expect(h.window.tbIsOfflineMode()).toBe(true);
    let resolve;h.fetch.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=h.window.tbShouldUseOfflineMode('retry');expect(h.window.tbIsOfflineMode()).toBe(true);
    resolve({status:200});expect(await pending).toBe(false);expect(h.window.tbIsOfflineMode()).toBe(false);
  });
  it('does not treat intentional request cancellation as a connectivity failure',async()=>{
    const h=harness();h.window.tbReportNetworkFailure=vi.fn();
    h.context.supabase={createClient:()=>({})};
    h.context.localStorage={getItem:()=>null};
    vm.runInNewContext(fs.readFileSync('public/legacy/js/00_supabase_config.js','utf8'),h.context);
    const error=Object.assign(new Error('cancelled'),{name:'AbortError'});
    h.fetch.mockRejectedValue(error);
    await expect(h.context.tbSupabaseFetch(h.window.SUPABASE_URL+'/rest/v1/test')).rejects.toThrow('cancelled');
    expect(h.window.tbReportNetworkFailure).not.toHaveBeenCalled();
  });
});
