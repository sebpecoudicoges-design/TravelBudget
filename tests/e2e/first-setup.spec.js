import { test, expect } from '@playwright/test';

for (const width of [1440,390]) for (const dark of [false,true]) test(`first setup preserves controls and payload ${width} dark=${dark}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.emulateMedia({colorScheme:dark?'dark':'light'});
  await page.route('**/first-setup-test',route=>route.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="${dark?'theme-dark':''}"></body></html>`}));
  await page.goto('/first-setup-test');
  await page.addStyleTag({url:'/src/ui/premium-theme.css'});
  await page.evaluate(()=>{window.sb={functions:{invoke:async()=>({data:{rates:{AUD:1.65}},error:null})}};});
  await page.addScriptTag({url:'/legacy/js/07_supabase_bootstrap.js'});
  await page.evaluate(()=>{
    window.setupDefaults={start:'2026-11-03',end:'2026-12-03',baseCurrency:'AUD',dailyBudgetBase:50,hasCash:true,hasBank:true,cashAmount:20,bankAmount:100,bankCurrency:'EUR'};
    window.setupDone=false;
    window.showFirstTimeWizardModal(window.setupDefaults).then(result=>{window.setupResult=result;window.setupDone=true;});
  });
  await expect(page.locator('.tb-first-run-overlay')).toBeVisible();
  await expect(page.locator('#wizSummaryWallets')).toHaveText('Cash + Banque');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#wizEnd').fill('2026-11-01');
  await page.locator('#wizCreate').click();
  await expect(page.locator('#wizError')).toContainText('date de fin');
  expect(await page.evaluate(()=>window.setupDone)).toBe(false);
  await page.locator('#wizEnd').fill('2026-12-03');
  await page.locator('#wizHasCash').uncheck();
  await expect(page.locator('#wizCashAmt')).toBeDisabled();
  await expect(page.locator('#wizSummaryWallets')).toHaveText('Banque');
  await page.locator('#wizFetchEcb').click();
  await expect(page.locator('#wizRate')).toHaveValue('1.65');
  await page.locator('#wizBankAmt').fill('123.45');
  await page.locator('#wizCreate').click();
  await expect(page.locator('.tb-first-run-overlay')).toHaveCount(0);
  expect(await page.evaluate(()=>window.setupResult)).toEqual({start:'2026-11-03',end:'2026-12-03',baseCurrency:'AUD',eurBaseRate:1.65,dailyBudgetBase:50,fxMode:'live',wallets:{cash:null,bank:{name:'Compte bancaire',type:'bank',currency:'EUR',balance:123.45}}});
  await page.evaluate(()=>{
    window.TB_LANG='en'; window.setupResult='pending';
    window.showFirstTimeWizardModal(window.setupDefaults).then(result=>{window.setupResult=result;});
  });
  await expect(page.locator('.tb-first-run-title')).toHaveText('Set up your budget space');
  await page.locator('#wizClose').click();
  await expect(page.locator('.tb-first-run-overlay')).toHaveCount(0);
  expect(await page.evaluate(()=>window.setupResult)).toBeNull();
  await expect(page.locator('#tb-first-run-style')).toHaveCount(1);
});
