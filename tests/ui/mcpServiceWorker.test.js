import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const cachePrefix = `travelbudget-pwa-${JSON.parse(fs.readFileSync('package.json','utf8')).version}`;

function worker() {
  const events={}, put=vi.fn(async()=>{}), remove=vi.fn(async()=>true);
  const fetch=vi.fn(async()=>new Response('page'));
  const caches={open:vi.fn(async()=>({put,addAll:async()=>{}})),match:vi.fn(async()=>null),keys:vi.fn(async()=>[`${cachePrefix}-runtime`,`${cachePrefix}-mcp-safe-runtime`,`${cachePrefix}-mcp-safe-static`,'travelbudget-pwa-previous-runtime','other-cache']),delete:remove};
  const context=vm.createContext({Request,Response,URL,fetch,caches, self:{location:{origin:'https://budget.example'},addEventListener:(type,fn)=>{events[type]=fn;},clients:{claim:async()=>{}},skipWaiting:async()=>{}}});
  vm.runInContext(fs.readFileSync('public/sw.js','utf8'),context);
  return {events,put,remove,fetch,caches};
}
it('bypasses OAuth, consent and authenticated requests before any cache or navigation handler',()=>{
  const {events,caches,fetch}=worker();
  for(const path of ['/mcp','/mcp-auth/connections','/.well-known/oauth-protected-resource/mcp','/connect-chatgpt.html','/connect-chatgpt.js']) {
    const request=new Request('https://budget.example'+path);
    const respondWith=vi.fn();events.fetch({request,respondWith});expect(respondWith).not.toHaveBeenCalled();
  }
  for(const init of [{headers:{Authorization:'Bearer private'}},{cache:'no-store'}]) {
    const respondWith=vi.fn();events.fetch({request:new Request('https://budget.example/anything',init),respondWith});expect(respondWith).not.toHaveBeenCalled();
  }
  expect(fetch).not.toHaveBeenCalled();expect(caches.match).not.toHaveBeenCalled();
});
it('does not warm up private endpoints through the service worker message API',async()=>{
  const {events,fetch}=worker();let pending;
  events.message({data:{type:'TB_CACHE_URLS',urls:['/mcp-auth/connections','/connect-chatgpt.html','https://cdn.example/script.js']},waitUntil:p=>{pending=p;}});
  await pending;expect(fetch).not.toHaveBeenCalled();
});
it('removes the previous same-version cache on activation',async()=>{
  const {events,remove}=worker();let pending;events.activate({waitUntil:p=>{pending=p;}});await pending;
  expect(remove.mock.calls.map(([name])=>name)).toEqual([`${cachePrefix}-runtime`,'travelbudget-pwa-previous-runtime']);
});
it('keeps ancillary navigations from replacing the offline app shell',async()=>{
  const {events,put}=worker();let pending;
  const request={url:'https://budget.example/projet.html',method:'GET',mode:'navigate',headers:new Headers()};
  events.fetch({request,respondWith:p=>{pending=p;}});await pending;expect(put).not.toHaveBeenCalled();
  events.fetch({request:{...request,url:'https://budget.example/index.html'},respondWith:p=>{pending=p;}});await pending;
  expect(put).toHaveBeenCalledWith('/index.html',expect.any(Response));
});
it('does not cache a private response even when its request has no authorization header',async()=>{
  const {events,put,fetch}=worker();let pending;
  fetch.mockResolvedValue(new Response('private',{headers:{'Cache-Control':'private, no-store'}}));
  events.fetch({request:new Request('https://budget.example/new-api'),respondWith:p=>{pending=p;}});await pending;
  expect(put).not.toHaveBeenCalled();
});
