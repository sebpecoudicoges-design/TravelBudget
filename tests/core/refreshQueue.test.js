import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/legacy/js/08_refresh.js', 'utf8');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(run) {
  const context = vm.createContext({ window: {}, _runRefreshFromServer: run, _tbApplyBusyState() {}, _tbRefreshLog() {} });
  vm.runInContext(`let _refreshInFlight=false, _refreshPending=false, _refreshPromise=null;
    ${source.slice(source.indexOf('async function refreshFromServer(opts'))}
    globalThis.status=()=>({busy:_refreshInFlight,pending:_refreshPending,promise:_refreshPromise});`, context);
  return context;
}
it('preserves the first failure even when a queued refresh succeeds, then allows retry', async () => {
  const first = deferred(), error = new Error('first failed');
  const run = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
  const app = harness(run);
  const pending = app.refreshFromServer();
  const queued = app.refreshFromServer();
  const results = Promise.allSettled([pending, queued]);
  first.reject(error);
  expect((await results).map(result => result.reason)).toEqual([error, error]);
  expect(run).toHaveBeenCalledTimes(2);
  expect(app.status()).toEqual({busy:false,pending:false,promise:null});
  await app.refreshFromServer();
  expect(run).toHaveBeenCalledTimes(3);
});
it('waits for exactly one queued pass after multiple manual requests', async () => {
  const first=deferred(), second=deferred();
  const run=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const app=harness(run);
  const pending=[app.refreshFromServer(),app.refreshFromServer(),app.refreshFromServer()];
  first.resolve();
  await vi.waitFor(()=>expect(run).toHaveBeenCalledTimes(2));
  expect(app.status().busy).toBe(true);
  second.resolve(); await Promise.all(pending);
  expect(run).toHaveBeenCalledTimes(2);
  expect(app.status()).toEqual({busy:false,pending:false,promise:null});
});
it('coalesces automatic refreshes without requesting another pass', async () => {
  const first=deferred(), run=vi.fn(()=>first.promise), app=harness(run);
  const pending=[app.refreshFromServer(),app.refreshFromServer({auto:true})];
  first.resolve(); await Promise.all(pending); expect(run).toHaveBeenCalledTimes(1);
});
it('propagates a queued failure after a successful first pass', async () => {
  const first=deferred(), error=new Error('queued failed');
  const app=harness(vi.fn().mockReturnValueOnce(first.promise).mockRejectedValueOnce(error));
  const results=Promise.allSettled([app.refreshFromServer(),app.refreshFromServer()]);
  first.resolve(); expect((await results).map(result=>result.reason)).toEqual([error,error]);
  expect(app.status()).toEqual({busy:false,pending:false,promise:null});
});
it('keeps both errors when both attempts fail', async () => {
  const first=deferred(), initial=new Error('initial'), next=new Error('next');
  const app=harness(vi.fn().mockReturnValueOnce(first.promise).mockRejectedValueOnce(next));
  const results=Promise.allSettled([app.refreshFromServer(),app.refreshFromServer()]);
  first.reject(initial);
  for(const result of await results) expect(result.reason.errors).toEqual([initial,next]);
  expect(app.status()).toEqual({busy:false,pending:false,promise:null});
});
