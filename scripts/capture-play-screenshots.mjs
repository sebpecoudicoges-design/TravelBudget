import { _android } from 'playwright';
import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureTables, fixtureUser, fixtureTime, fixtureResponse, projectOrigin } from './fixtures/connectedStartup.mjs';

const pkg = 'com.travelbudget.app';
const serial = 'emulator-5554';
const origin = 'https://localhost';
const day = fixtureTime.slice(0,10);
const walletId = fixtureTables.wallets[0].id;
const card = { ...fixtureTables.wallets[0], currency:'NZD', name:'Carte voyage', balance:300 };
const row = (id, amount, date, label, category) => ({
  ...fixtureTables.transactions[0], id, amount, wallet_id:walletId, currency:'NZD', label, category,
  date_start:date, date_end:date, budget_date_start:date, budget_date_end:date,
  paid_at:date+'T12:00:00Z', created_at:date+'T09:00:00Z',
});
const categories = [
  ['Repas','#ff8060'],
  ['Transport','#3289a2'],
  ['Activités','#776ed1'],
];
const tables = {
  ...structuredClone(fixtureTables),
  profiles:[{ ...fixtureTables.profiles[0], role:'user' }],
  settings:[{ ...fixtureTables.settings[0], theme:'light', base_currency:'NZD', language:'fr', palette_preset:'Ocean' }],
  travels:[{ ...fixtureTables.travels[0], name:'Week-end à Taupō', base_currency:'NZD', start_date:'2026-10-23', end_date:'2026-10-25' }],
  periods:[{ ...fixtureTables.periods[0], name:'Taupō', base_currency:'NZD', eur_base_rate:1.95, daily_budget_base:150, start_date:'2026-10-23', end_date:'2026-10-25' }],
  budget_segments:[{ ...fixtureTables.budget_segments[0], base_currency:'NZD', eur_base_rate_fixed:1.95, daily_budget_base:150, start_date:'2026-10-23', end_date:'2026-10-25' }],
  categories:categories.map(([name,color],i)=>({ ...fixtureTables.categories[0], id:'synth-cat-'+i,name,color,sort_order:i })),
  wallets:[card],
  transactions:[
    row('demo-meal',18,day,'Déjeuner au lac','Repas'),
    row('demo-bus',12,day,'Bus local','Transport'),
    row('demo-hike',30,'2026-10-23','Sortie volcan','Activités'),
  ],
  trip_invites:[], trip_groups:[], trip_participants:[],
  v_wallet_balances:[],budget_segment_budget_reference_override:[],v_country_budget_reference_latest:[],
  travel_budget_reference_profile:[],v_transaction_analytic_expenses:[],fx_rates:[],
};
const out = join(process.env.RUNNER_TEMP ?? '', 'travelbudget-play');
if (!process.env.RUNNER_TEMP || !process.env.GITHUB_ACTIONS
  || process.env.GITHUB_REF !== 'refs/heads/codex/play-screenshots-10.5.397') {
  throw Error('Use only the isolated hosted emulator workflow branch');
}
function renderFixtureBootstrap() {
  const initConfig = JSON.stringify({ origin, projectOrigin, fixtureUser, fixtureTime, tables });
  return `
    (() => {
      const { origin, projectOrigin, fixtureUser, fixtureTime, tables } = ${initConfig};
      if (window.location.origin !== origin) return;
      const NativeDate = Date;
      const offset = NativeDate.parse(fixtureTime) - NativeDate.now();
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [NativeDate.now()+offset])); }
        static now() { return NativeDate.now()+offset; }
      };
      const encode = value => btoa(JSON.stringify(value)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
      const user = { id: fixtureUser, email: 'voyage-demo@example.invalid', aud: 'authenticated', role: 'authenticated' };
      const expiry = 4070908800;
      const token = encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:fixtureUser,aud:'authenticated',role:'authenticated',exp:expiry})+'.synthetic-signature';
      localStorage.setItem('sb-obznbrzarhvmlbprcfie-auth-token', JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',token_type:'bearer',expires_at:expiry,user}));
      localStorage.setItem('travelbudget_guided_tour_done_v2_'+fixtureUser,'1');
      const localFetch = window.fetch.bind(window);
      const fixtureResponse = (${fixtureResponse.toString()});
      const counts = { served: {}, blocked: {} };
      window.__playSyntheticTransport = counts;
      // Test the connected UI with a synthetic service while keeping the
      // actual guest's IPv4 and IPv6 egress physically blocked.
      if (navigator.onLine === false) Object.defineProperty(navigator, 'onLine', {value:true});
      window.fetch = async (input, options) => {
        const raw = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
        const url = new URL(raw,window.location.href);
        if (url.origin === origin) return localFetch(input,options);
        const method = String(options?.method ?? input?.method ?? 'GET').toUpperCase();
        const key = method+' '+url.pathname;
        if (url.origin === projectOrigin) {
          try {
            const methodHeaders = Object.fromEntries(new Headers(options?.headers ?? input?.headers));
            const value = url.pathname === '/functions/v1/fx-latest' && method === 'POST'
              ? {base:'EUR',date:fixtureTime.slice(0,10),rates:{EUR:1,NZD:1.95}}
              : fixtureResponse(url.href,method,methodHeaders,tables);
            counts.served[key]=(counts.served[key]||0)+1;
            return new Response(method==='HEAD'?null:JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
          } catch {}
        }
        const printableKey = url.origin === projectOrigin ? key : 'other-origin';
        counts.blocked[printableKey]=(counts.blocked[printableKey]||0)+1;
        return new Response('{"message":"Not part of the read-only synthetic image fixture"}',{status:404,headers:{'Content-Type':'application/json'}});
      };
    })();`;
}
if (process.argv.includes('--prepare-fixture')) {
  // Modify only Vite build output in this ephemeral debug-capture job. Never
  // write the fixture into released source or upload/distribute this APK.
  const dist = join(process.cwd(),'dist');
  const htmlPath = join(dist,'index.html');
  const html = await readFile(htmlPath,'utf8');
  if (!html.includes('<head>') || html.includes('play-store-synthetic-fixture.js')) throw Error('Unexpected screenshot build HTML');
  await writeFile(join(dist,'play-store-synthetic-fixture.js'),renderFixtureBootstrap());
  await writeFile(htmlPath,html.replace('<head>','<head><script src="./play-store-synthetic-fixture.js"></script>'));
  console.log('Prepared test-only synthetic bootstrap in dist');
  process.exit(0);
}
async function bounded(operation, text, ms=25000) {
  let timer;
  try { return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(text)),ms);})]); }
  finally { clearTimeout(timer); }
}
const devices = await _android.devices();
if (devices.length !== 1 || devices[0].serial() !== serial) throw Error('Expected exactly one isolated emulator; no physical device is allowed');
const [device] = devices;
try {
  const view = await device.webView({pkg},{timeout:30000});
  const page = await bounded(view.page(),'Timed out connecting to the Android WebView');
  console.log('Native WebView attached');
  await expect.poll(()=>page.url()).toMatch(/^https:\/\/localhost(?:\/|$)/);
  if (new URL(page.url()).origin!==origin) throw Error('Unexpected native WebView origin');
  page.on('pageerror', error => console.log('fixture pageerror',String(error).slice(0,180)));
  await expect.poll(()=>page.evaluate(()=>window.Capacitor?.getPlatform?.())).toBe('android');
  console.log('Native platform verified; waiting for the synthetic view');
  await expect.poll(async()=>page.evaluate(()=>!!window.__playSyntheticTransport)).toBe(true);
  console.log('Synthetic transport installed',await page.evaluate(()=>({online:navigator.onLine,hasSyntheticSession:!!localStorage.getItem('sb-obznbrzarhvmlbprcfie-auth-token'),scriptCount:document.scripts.length})));
  try {
    await expect.poll(async()=>page.evaluate(()=>window.__playSyntheticTransport.served['GET /rest/v1/wallets']||0),{timeout:30000}).toBeGreaterThan(0);
  } catch (error) {
    console.log('fixture debugging',JSON.stringify(await page.evaluate(()=>({
      platform:window.Capacitor?.getPlatform?.(), selected:document.body.dataset.tbView,
      authVisible:document.body.classList.contains('tb-auth-visible'), role:window.sbRole,
      offline:window.tbIsOfflineMode?.(), title:document.title,
      bootText:document.querySelector('#auth-overlay')?.innerText?.slice(0,500),
      synthetic:window.__playSyntheticTransport
    }))));
    throw error;
  }
  await mkdir(out,{recursive:true});

  async function capture(name, target) {
    await expect(target).toBeVisible();
    await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForTimeout(450);
    const png = execFileSync('adb',['-s',serial,'exec-out','screencap','-p'],{maxBuffer:16*1024*1024});
    if (png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || png.readUInt32BE(16)!==1080 || png.readUInt32BE(20)!==1920) throw Error('Native PNG resolution mismatch');
    await writeFile(join(out,name+'.png'),png);
    console.log('Verified native RGB source',name);
  }
  async function nav(key) {
    const menu = page.locator('#tb-mobile-nav-toggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded')!=='true') await menu.click();
    await page.locator('#tab-'+key).click();
    await expect(page.locator('#view-'+key)).toBeVisible();
  }
  const wallet = page.locator(`#wallets-container [data-wallet-id="${walletId}"]`).first();
  try { await expect(wallet).toContainText(/240[,.]00/,{timeout:30000}); }
  catch (error) {
    console.log('wallet debugging',JSON.stringify(await page.evaluate(()=>({
      selected:document.body.dataset.tbView, role:window.sbRole,
      offline:window.tbIsOfflineMode?.(), wallets:window.state?.wallets?.length,
      nativeWalletText:document.querySelector('#wallets-container')?.innerText?.slice(0,500),
      synthetic:window.__playSyntheticTransport
    }))));
    throw error;
  }
  await expect.poll(()=>page.evaluate(()=>window.sbRole)).toBe('user');
  await expect(page.locator('#tab-trip')).toBeHidden();
  await capture('screenshot-01-compte',wallet);
  await page.evaluate(()=>window.showView('trip'));
  await expect(page.locator('#view-validation')).toBeVisible();
  await expect(page.locator('#view-trip')).toBeHidden();

  await nav('transactions');
  const transactions = page.locator('#tx-list');
  const meal = transactions.getByText(/Déjeuner au lac/).first();
  await expect(meal).toBeVisible();
  await expect(transactions).toContainText('Bus local');
  await capture('screenshot-02-transactions',meal);
  await nav('dashboard');
  await page.locator('#db-today').click();
  const today=page.locator('#daily-budget-container .day').filter({hasText:day});
  await expect(today).toContainText('120 NZD');
  await expect(today.locator('.row b').first()).toHaveText('−30 NZD');
  await capture('screenshot-03-budget',today);
  await nav('analysis');
  const summary = page.locator('#analysis-summary');
  await expect(summary.locator('.analysis-stat--glass-blue .analysis-stat-value').first()).toContainText(/^60[,.]00/);
  await capture('screenshot-04-analyse',page.locator('#analysis-category-bars-chart'));
  await writeFile(join(out,'provenance.txt'),
    'TravelBudget 10.5.397, exact released UI from 2a85d8941df4a18d780236ae49eccc323759f44f.\n'+
    'Android emulator native ADB captures, 1080×1920.\n'+
    'Unpublished debug capture build from released source, with synthetic read-only data bootstrap; no production account, secrets, or traffic.\n'+
    'The Taupō data is fictional. Standard user: wallet 240 NZD, 3 transactions, budget remaining 120 NZD, analysis net 60 NZD. Trip redirects to validation (not depicted).\n');
} finally { await device.close(); }
