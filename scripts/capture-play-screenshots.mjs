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

      // The actual release UI, running in its Android WebView, exposes no
      // debug connection to this capture task. These local-only test checks
      // trigger the same views as normal navigation and report readiness
      // through native debug logcat. They do not change rendered text/layout.
      const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
      const bodyView = () => document.body?.dataset.tbView;
      const text = node => node?.innerText?.trim() || '';
      const visible = node => !!node && node.getClientRects().length > 0;
      const poll = async (check,stage,ms=22000) => {
        for (let i=0; i<Math.ceil(ms/200);i++) {
          const value=check();
          if (value) return value;
          await sleep(200);
        }
        throw Error(stage);
      };
      const ready = async (name, check) => {
        const target=await poll(check,name);
        target.scrollIntoView({block:'center',behavior:'instant'});
        await sleep(900);
        if (!check()) throw Error(name+'-after-scroll');
        console.info('TB_PLAY_NATIVE_READY '+name);
        await sleep(15000);
        console.info('TB_PLAY_NATIVE_LEAVE '+name);
      };
      const navigate = async name => {
        window.showView(name);
        await poll(()=>bodyView()===name,'view-'+name);
      };
      void (async()=>{
        try {
          const day=fixtureTime.slice(0,10);
          const walletId=tables.wallets[0].id;
          await poll(()=>window.Capacitor?.getPlatform?.()==='android' &&
            typeof window.showView==='function' &&
            window.sbRole==='user' && counts.served['GET /rest/v1/wallets']>0 &&
            document.body && !document.body.classList.contains('tb-auth-visible'),'native-standard-account',26000);
          const tripTab=document.querySelector('#tab-trip');
          if (visible(tripTab) && getComputedStyle(tripTab).visibility!=='hidden') throw Error('trip-tab-visible');
          window.showView('trip');
          await poll(()=>bodyView()==='validation'&&!visible(document.querySelector('#view-trip')),'trip-role-gate');
          await navigate('dashboard');
          await ready('screenshot-01-compte',()=>{
            const wallet=document.querySelector('#wallets-container [data-wallet-id="'+walletId+'"]');
            return visible(wallet) && text(wallet).includes('Carte voyage') && /240[,.]00/.test(text(wallet)) ? wallet : null;
          });
          await navigate('transactions');
          await ready('screenshot-02-transactions',()=>{
            const list=document.querySelector('#tx-list');
            const row=Array.from(list?.querySelectorAll('*')||[]).find(e=>e.childNodes.length && text(e).includes('Déjeuner au lac') && !Array.from(e.children).some(c=>text(c).includes('Déjeuner au lac')));
            return visible(row) && text(list).includes('Bus local') && text(list).includes('Sortie volcan') ? row : null;
          });
          await navigate('dashboard');
          document.querySelector('#db-today')?.click();
          await ready('screenshot-03-budget',()=>{
            const target=Array.from(document.querySelectorAll('#daily-budget-container .day')).find(el=>text(el).includes(day));
            return visible(target) && text(target).includes('120 NZD') && text(target.querySelector('.row b'))==='−30 NZD' ? target : null;
          });
          await navigate('analysis');
          await ready('screenshot-04-analyse',()=>{
            const total=document.querySelector('#analysis-summary .analysis-stat--glass-blue .analysis-stat-value');
            const chart=document.querySelector('#analysis-category-bars-chart');
            return /^60[,.]00/.test(text(total)) && visible(chart) && chart.querySelector('canvas,svg') ? chart : null;
          });
          console.info('TB_PLAY_NATIVE_DONE');
        } catch(error) {
          // Labels only, no account fields, URLs, request headers, or tokens.
          console.info('TB_PLAY_NATIVE_FAIL '+String(error?.message||'unknown').replace(/[^a-z0-9-]/gi,'').slice(0,110));
        }
      })();
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
function adb(args,options={}) {
  return execFileSync('adb',['-s',serial,...args],{timeout:9000,maxBuffer:18*1024*1024,...options});
}
const serials=execFileSync('adb',['devices'],{encoding:'utf8',timeout:5000})
  .split(/\r?\n/).map(l=>l.trim().split(/\s+/)).filter(([,status])=>status==='device').map(([id])=>id);
if (serials.length!==1 || serials[0]!==serial) throw Error('Exactly one isolated emulator is required');
await mkdir(out,{recursive:true});
const getState=()=>{
  const log=adb(['logcat','-d','-v','brief'],{encoding:'utf8'});
  const states=[...log.matchAll(/TB_PLAY_NATIVE_(READY|LEAVE|DONE|FAIL)(?: ([a-zA-Z0-9-]+))?/g)];
  const last=states.at(-1);
  return last ? {type:last[1],name:last[2]||''} : null;
};
const passed=new Set();
const expected=new Set(['screenshot-01-compte','screenshot-02-transactions','screenshot-03-budget','screenshot-04-analyse']);
const deadline=Date.now()+120000;
while (Date.now()<deadline) {
  const state=getState();
  if (state?.type==='READY' && expected.has(state.name) && !passed.has(state.name)) {
    const png=adb(['exec-out','screencap','-p']);
    const after=getState();
    // Never count a capture if the app left the verified screen during it.
    if (after?.type==='READY' && after.name===state.name) {
      if (png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || png.readUInt32BE(16)!==1080 || png.readUInt32BE(20)!==1920) {
        throw Error('Native PNG resolution mismatch');
      }
      await writeFile(join(out,state.name+'.png'),png);
      passed.add(state.name);
      console.log('Verified native capture',state.name);
    }
  }
  if (state?.type==='FAIL') throw Error('Native app fixture could not verify stage: '+state.name);
  if (state?.type==='DONE' && passed.size!==expected.size) throw Error('App finished but not all native captures arrived: '+passed.size);
  if (passed.size===expected.size) break;
  await new Promise(resolve=>setTimeout(resolve,850));
}
if (passed.size!==expected.size) throw Error('Native capture timeout: '+passed.size+' of '+expected.size+' screenshots');
await writeFile(join(out,'provenance.txt'),
  'TravelBudget 10.5.397, exact UI source at 2a85d8941df4a18d780236ae49eccc323759f44f.\n'+
  'Raw native ADB emulator captures, 1080×1920, standard app role.\n'+
  'Unpublished debug capture build, synthetic read-only bootstrap, no external egress or account.\n'+
  'Fictional Taupō data: wallet 240 NZD, 3 transactions, 120 NZD left for the day, 60 NZD in Analyse. Trip access refused to standard role (not pictured).\n');
