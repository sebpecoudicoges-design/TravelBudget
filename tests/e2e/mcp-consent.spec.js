import { test, expect } from '@playwright/test';

const request = {client_id:'travelbudget-chatgpt',resource:'https://budget.example/mcp',redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect',response_type:'code',scope:'finance:read',state:'test-state',code_challenge:'a'.repeat(43),code_challenge_method:'S256'};
async function setup(page,{signedIn=true,fail=false}={}) {
  const calls=[]; let grants=[{id:'grant-a',created_at:'2026-11-01T00:00:00Z',expires_at:'2026-12-01T00:00:00Z'}];
  let preferences={finance_enabled:false,document_ids:[],documents:[{id:'doc-a',name:'Document choisi',mime_type:'text/plain',size_bytes:42}]};
  await page.route('**/vendor/supabase-2.110.6.js',route=>route.fulfill({contentType:'application/javascript',body:`window.__testSession=${signedIn?JSON.stringify({access_token:'synthetic-session',user:{id:'owner-a',email:'test@example.com'}}):'null'}; window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__testSession}})}})};`}));
  await page.route('**/functions/v1/travelbudget-mcp/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    calls.push({path,body:req.method()==='POST'?req.postDataJSON():null,authorization:req.headers().authorization});
    if(fail && path.endsWith('/authorize'))return route.fulfill({status:503,json:{error:'unavailable'}});
    if(path.endsWith('/config'))return route.fulfill({json:{supabaseUrl:'https://obznbrzarhvmlbprcfie.supabase.co',publishableKey:'public-test-key'}});
    if(path.endsWith('/request'))return route.fulfill({json:{request}});
    if(path.endsWith('/connections'))return route.fulfill({json:grants});
    if(path.endsWith('/sharing')){
      if(req.method()==='POST')preferences={...preferences,...req.postDataJSON()};
      return route.fulfill({json:preferences});
    }
    if(path.endsWith('/disconnect')){grants=[];return route.fulfill({json:{revoked:true}});}
    if(path.endsWith('/authorize'))return route.fulfill({json:{redirect_uri:request.redirect_uri+'?'+(req.postDataJSON().approved?'code=test-code':'error=access_denied')+'&state=test-state&iss=https%3A%2F%2Fbudget.example%2Fmcp-auth'}});
    return route.fulfill({status:404,json:{error:'notfound'}});
  });
  await page.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Callback synthétique</p>'}));
  return calls;
}
for(const width of [1440,390])for(const theme of ['light','dark']) {
  test(`MCP consent ${theme} ${width}: scope, revoke, approve and safe layout`,async({page})=>{
    await page.setViewportSize({width,height:960});await page.emulateMedia({colorScheme:theme});
    const calls=await setup(page);
    await page.goto('/connect-chatgpt.html#'+new URLSearchParams(request));
    await expect(page.locator('#approve')).toBeEnabled();
    await expect(page.locator('#account')).toContainText('test@example.com');
    await expect(page.getByText('Aucune modification de transaction ni de solde.',{exact:false})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.codex/releases/10.5.387/mcp-consent-${theme}-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Révoquer cet accès'}).click();
    await expect(page.locator('#connections')).toHaveText('Aucun accès actif.');
    expect(calls.find(c=>c.path.endsWith('/disconnect'))).toMatchObject({body:{grant_id:'grant-a'},authorization:'Bearer synthetic-session'});
    await page.locator('#approve').click();
    await expect(page).toHaveURL(/chatgpt\.com\/connector_platform_oauth_redirect\?code=/);
    expect(calls.find(c=>c.path.endsWith('/authorize')).body).toMatchObject({...request,approved:true});
  });
}
test('MCP consent permits refusal without login and does not send a session',async({page})=>{
  const calls=await setup(page,{signedIn:false});
  await page.goto('/connect-chatgpt.html#'+new URLSearchParams(request));
  await expect(page.locator('#login')).toBeVisible();await expect(page.locator('#approve')).toBeDisabled();
  await page.locator('#deny').click();await expect(page).toHaveURL(/error=access_denied/);
  expect(calls.find(c=>c.path.endsWith('/authorize')).authorization).toBeUndefined();
});

for(const width of [1440,390])for(const theme of ['light','dark'])test(`MCP sharing ${theme} ${width}: explicit selection, persistence and removal`,async({page})=>{
  await page.setViewportSize({width,height:960});await page.emulateMedia({colorScheme:theme});
  const calls=await setup(page);
  await page.goto('/connect-chatgpt.html');
  await expect(page.locator('#sharing-panel')).toBeVisible();
  await expect(page.locator('#finance-sharing')).not.toBeChecked();
  await expect(page.locator('#sharing-documents input')).not.toBeChecked();
  await page.locator('#finance-sharing').check();await page.locator('#sharing-documents input').check();
  await page.locator('#save-sharing').click();await expect(page.locator('#sharing-status')).toContainText('Choix enregistrés');
  expect(calls.find(c=>c.path.endsWith('/sharing')&&c.body).body).toEqual({finance_enabled:true,sport_enabled:false,nutrition_enabled:false,all_documents:false,document_ids:['doc-a']});
  await page.reload();await expect(page.locator('#sharing-documents input')).toBeChecked();
  await page.locator('#sharing-panel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.codex/releases/10.5.387/mcp-sharing-${theme}-${width}.png`,fullPage:true});
  await page.locator('#clear-shared-documents').click();await page.locator('#save-sharing').click();
  await expect(page.locator('#sharing-status')).toContainText('Choix enregistrés');
  expect(calls.filter(c=>c.path.endsWith('/sharing')&&c.body).at(-1).body.document_ids).toEqual([]);
});

test('MCP sharing syncs only current-account settings and rejects a switched account',async({page})=>{
 const calls=await setup(page);await page.goto('/connect-chatgpt.html');await expect(page.locator('#sharing-panel')).toBeVisible();
 const travel='33333333-3333-4333-8333-333333333333';
 await page.evaluate(travel=>{localStorage.setItem('tb-accounting-v1:owner-a:'+travel,JSON.stringify({equityMode:'calculated'}));localStorage.setItem('tb-accounting-v1:owner-b:'+travel,JSON.stringify({private:'other-owner'}));},travel);
 await page.locator('#accounting-sharing').check();await page.locator('#save-sharing').click();await expect(page.locator('#sharing-status')).toContainText('Choix enregistrés');
 expect(calls.find(c=>c.path.endsWith('/sharing')&&c.body).body.accounting_settings).toEqual({[travel]:{equityMode:'calculated'}});
 await page.evaluate(()=>window.__testSession.user.id='owner-b');await page.locator('#save-sharing').click();
 await expect(page.locator('#sharing-status')).toContainText('Le compte a changé');
 expect(calls.filter(c=>c.path.endsWith('/sharing')&&c.body)).toHaveLength(1);
});
test('MCP consent preserves the choice after failure and rejects a switched account',async({page})=>{
  const calls=await setup(page,{fail:true});
  await page.goto('/connect-chatgpt.html#'+new URLSearchParams(request));await expect(page.locator('#approve')).toBeEnabled();
  await page.locator('#approve').click();await expect(page.locator('#status')).toContainText('Connexion indisponible');await expect(page.locator('#approve')).toBeEnabled();
  await page.evaluate(()=>window.__testSession.user={id:'owner-b',email:'other@example.com'});
  await page.locator('#approve').click();await expect(page.locator('#status')).toContainText('Le compte a changé');
  expect(calls.filter(c=>c.path.endsWith('/authorize'))).toHaveLength(1);
});

test('explicit all-documents and health consent persists and can be withdrawn',async({page})=>{
 const calls=await setup(page);await page.goto('/connect-chatgpt.html');await expect(page.locator('#sharing-panel')).toBeVisible();
 for(const id of ['sport-sharing','nutrition-sharing','all-documents-sharing']){await expect(page.locator('#'+id)).not.toBeChecked();await page.locator('#'+id).check();}
 await expect(page.locator('#sharing-documents input')).toBeDisabled();await page.locator('#save-sharing').click();await expect(page.locator('#sharing-status')).toContainText('Choix enregistrés');
 expect(calls.filter(c=>c.path.endsWith('/sharing')&&c.body).at(-1).body).toMatchObject({all_documents:true,sport_enabled:true,nutrition_enabled:true,document_ids:[]});
 await page.reload();await expect(page.locator('#all-documents-sharing')).toBeChecked();await page.locator('#clear-shared-documents').click();await page.locator('#sport-sharing').uncheck();await page.locator('#nutrition-sharing').uncheck();await page.locator('#save-sharing').click();await expect(page.locator('#sharing-status')).toContainText('Choix enregistrés');
 expect(calls.filter(c=>c.path.endsWith('/sharing')&&c.body).at(-1).body).toMatchObject({all_documents:false,sport_enabled:false,nutrition_enabled:false,document_ids:[]});
});
