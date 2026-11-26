import { _android } from 'playwright';
import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureTables, fixtureUser, fixtureTime, installConnectedFixture } from './fixtures/connectedStartup.mjs';

const pkg = 'com.travelbudget.app';
const serial = 'emulator-5554';
const origin = 'https://localhost';
const day = fixtureTime.slice(0,10);
const walletId = fixtureTables.wallets[0].id;
const tripId = '88a55db7-ec9f-4c05-82f7-478a09e43001';
const expenseId = '88a55db7-ec9f-4c05-82f7-478a09e43002';
const me = '88a55db7-ec9f-4c05-82f7-478a09e43003';
const friend = '88a55db7-ec9f-4c05-82f7-478a09e43004';
const card = { ...fixtureTables.wallets[0], currency:'NZD', name:'Carte voyage', balance:300 };
const row = (id, amount, extra) => ({
  ...fixtureTables.transactions[0], id, amount, wallet_id:walletId, currency:'NZD',
  date_start:day, date_end:day, budget_date_start:day, budget_date_end:day,
  category:'Repas', created_at:fixtureTime, ...extra,
});
const tripRow = (id, fields) => ({ id, trip_id:tripId, ...fields });
const tables = {
  ...structuredClone(fixtureTables),
  profiles:[{ ...fixtureTables.profiles[0], role:'test' }],
  settings:[{ ...fixtureTables.settings[0], theme:'light', base_currency:'NZD', language:'fr', palette_preset:'Ocean' }],
  travels:[{ ...fixtureTables.travels[0], name:'Week-end à Taupō', base_currency:'NZD', start_date:'2026-10-23', end_date:'2026-10-25' }],
  periods:[{ ...fixtureTables.periods[0], name:'Taupō', base_currency:'NZD', eur_base_rate:1.95, daily_budget_base:150, start_date:'2026-10-23', end_date:'2026-10-25' }],
  budget_segments:[{ ...fixtureTables.budget_segments[0], base_currency:'NZD', eur_base_rate_fixed:1.95, daily_budget_base:150, start_date:'2026-10-23', end_date:'2026-10-25' }],
  categories:[{ ...fixtureTables.categories[0], name:'Repas', color:'#e87954' }],
  wallets:[card],
  transactions:[
    row('demo-advance',60,{ label:'[Trip] Avance - Dîner à Taupō', affects_budget:false, out_of_budget:true, trip_expense_id:expenseId, paid_at:day+'T12:00:00Z' }),
    row('demo-part',30,{ label:'[Trip] Dîner à Taupō', pay_now:false, paid_at:null, is_internal:true, trip_share_link_id:'demo-budget-link' }),
  ],
  trip_groups:[{ id:tripId, name:'Week-end à Taupō', base_currency:'NZD', user_id:fixtureUser }],
  trip_participants:[tripRow('demo-participant',{auth_user_id:fixtureUser,role:'owner'})],
  trip_members:[
    tripRow(me,{ name:'Camille',auth_user_id:fixtureUser,user_id:fixtureUser,created_at:'2026-10-01' }),
    tripRow(friend,{name:'Alex',created_at:'2026-10-02'}),
  ],
  trip_expenses:[tripRow(expenseId,{date:day,label:'Dîner à Taupō',kind:'expense',amount:60,currency:'NZD',category:'Repas',paid_by_member_id:me,transaction_id:'demo-advance',budget_date_start:day,budget_date_end:day})],
  trip_expense_shares:[
    tripRow('demo-share-a',{expense_id:expenseId,member_id:me,share_amount:30}),
    tripRow('demo-share-b',{expense_id:expenseId,member_id:friend,share_amount:30}),
  ],
  trip_expense_budget_links:[tripRow('demo-budget-link',{expense_id:expenseId,member_id:me,transaction_id:'demo-part'})],
  trip_settlement_events:[],trip_expense_documents:[],trip_settlements:[],trip_payer_approvals:[],
  v_wallet_balances:[],budget_segment_budget_reference_override:[],v_country_budget_reference_latest:[],
  travel_budget_reference_profile:[],v_transaction_analytic_expenses:[],fx_rates:[],
};
const out = join(process.env.RUNNER_TEMP ?? '', 'travelbudget-play');
if (!process.env.RUNNER_TEMP || !process.env.GITHUB_ACTIONS) throw Error('Use only the isolated hosted emulator workflow');
const devices = await _android.devices();
if (devices.length !== 1 || devices[0].serial() !== serial) throw Error('Expected exactly one isolated emulator; no physical device is allowed');
const [device] = devices;
try {
  const view = await device.webView({pkg},{timeout:30000});
  const page = await view.page();
  await expect.poll(()=>page.url()).toMatch(/^https:\/\/localhost(?:\/|$)/);
  const actual = new URL(page.url());
  if (actual.origin !== origin) throw Error('Unexpected app origin; refusing to use any network/server URL');
  await installConnectedFixture(page,origin,{tables});
  await page.addInitScript(user => {
    localStorage.setItem('travelbudget_guided_tour_done_v2_'+user,'1');
  },fixtureUser);
  // The fixture covers all GET/HEAD reads; no remote traffic succeeds even if
  // an app worker or plugin bypasses WebView CDP (guest IPv4+IPv6 blocks it).
  await page.goto(origin+'/?freeze=1',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>window.Capacitor?.getPlatform?.())).toBe('android');
  await mkdir(out,{recursive:true});

  async function capture(name, target) {
    await expect(target).toBeVisible();
    await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForTimeout(450);
    const png = execFileSync('adb',['-s',serial,'exec-out','screencap','-p'],{maxBuffer:16*1024*1024});
    if (png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || png.readUInt32BE(16)!==1080 || png.readUInt32BE(20)!==1920) throw Error('Native PNG resolution mismatch');
    await writeFile(join(out,name+'.png'),png);
  }
  async function nav(key) {
    const menu = page.locator('#tb-mobile-nav-toggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded')!=='true') await menu.click();
    await page.locator('#tab-'+key).click();
    await expect(page.locator('#view-'+key)).toBeVisible();
  }
  const wallet = page.locator(`#wallets-container [data-wallet-id="${walletId}"]`).first();
  await expect(wallet).toContainText(/240[,.]00/,{timeout:30000});
  await capture('screenshot-01-compte',wallet);
  await nav('trip');
  const trip = page.locator('.trip-analysis-summary');
  await expect(trip).toContainText(/Alex doit 30(?:[,.]00)? NZD/);
  await capture('screenshot-02-partage',trip);
  await nav('dashboard');
  await page.locator('#db-today').click();
  const today=page.locator('#daily-budget-container .day').filter({hasText:day});
  await expect(today).toContainText('120 NZD');
  await expect(today.locator('.row b').first()).toHaveText('−30 NZD');
  await capture('screenshot-03-budget',today);
  await nav('analysis');
  const summary = page.locator('#analysis-summary');
  await expect(summary.locator('.analysis-stat--glass-blue .analysis-stat-value').first()).toContainText(/^30[,.]00/);
  await capture('screenshot-04-analyse',page.locator('#analysis-category-bars-chart'));
  await writeFile(join(out,'provenance.txt'),
    'TravelBudget 10.5.397, exact released UI from 2a85d8941df4a18d780236ae49eccc323759f44f.\n'+
    'Android emulator native ADB captures, 1080×1920.\n'+
    'Build: debug package com.travelbudget.app; no production account, secrets, or network traffic.\n'+
    'The Taupō data and participants are fictional. Pass: wallet 240 NZD, Trip 30 NZD due, budget remaining 120 NZD, analysis net 30 NZD.\n');
} finally { await device.close(); }
