import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const styles=[...fs.readFileSync('index.html','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
for(const width of [1440,900,600,390]) for(const dark of [false,true]) for(const native of [false,true]) test(`wallet actions contained ${width} dark=${dark} native=${native}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/wallet-layout-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body class="tb-view-dashboard ${dark?'theme-dark':''} ${native?'tb-capacitor-app':''}"><main id="view-dashboard"><div id="wallets-list" style="width:min(100%,360px)"><div class="wallet wallet-item"></div></div></main></body></html>`}));
 await page.goto('/wallet-layout-test');await page.addStyleTag({url:'/src/ui/premium-theme.css'});
 await page.evaluate(async()=>{
 const {renderWalletCard}=await import('/src/features/dashboard/dashboardView.js');
 const card = document.querySelector('.wallet-item');
 card.dataset.walletId = 'w';
 card.innerHTML=renderWalletCard({wallet:{id:'w',name:'Banque Australie',currency:'AUD'},balance:'1234,56 AUD',t:k=>({'wallet.action.archive':'Archiver ce portefeuille' ,'wallet.action.add_expense':'Ajouter une dépense','wallet.action.add_income':'Ajouter un revenu'}[k]||k)});
 const other = document.createElement('div');
 other.className = 'wallet wallet-item'; other.dataset.walletId = 'other';
 other.innerHTML = renderWalletCard({wallet:{id:'other',name:'Second wallet',currency:'EUR'},archived:true});
 card.parentElement.append(other);
 localStorage.setItem('travelbudget_wallet_order_v2', JSON.stringify(['other','w','w']));
 });
 await page.addScriptTag({url:'/legacy/js/21_dashboard_drag.js'});
 await page.evaluate(()=>{
   const list = document.querySelector('#wallets-list');
   window.enableWalletsReorderDrag(list);
   window.enableWalletsReorderDrag(list);
 });
 await expect(page.locator('#wallets-list > button')).toHaveCount(0);
 expect(await page.locator('#wallets-list > .wallet').evaluateAll(cards=>cards.map(c=>c.dataset.walletId))).toEqual(['other','w']);
 expect(await page.evaluate(()=>{
   const original = Storage.prototype.setItem;
   let writes = 0;
   Storage.prototype.setItem = function(key, value) { writes++; return original.call(this, key, value); };
   try {
     document.querySelector('.wallet[data-wallet-id="w"]').dispatchEvent(new Event('dragend'));
     return writes;
   } finally { Storage.prototype.setItem = original; }
 })).toBe(1);
 await expect(page.locator('.wallet[data-wallet-id="w"] [data-wallet-archive-action="archive"]')).toHaveCount(1);
 await expect(page.locator('.wallet[data-wallet-id="other"] [data-wallet-archive-action="unarchive"]')).toHaveCount(1);
 const failures=await page.locator('.wallet[data-wallet-id="w"] .tb-wallet-action-col').evaluate(panel=>{
 const p=panel.getBoundingClientRect(),card=panel.closest('.wallet-item').getBoundingClientRect();
 return [...panel.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.left<p.left||r.right>p.right+1||r.bottom>p.bottom+1||r.bottom>card.bottom+1||r.right>card.right+1;}).map(b=>b.textContent);
 });expect(failures).toEqual([]);
 await page.evaluate(()=>document.querySelector('.wallet[data-wallet-id="w"]').addEventListener('click',e=>{window.clickedWallet=e.target.dataset.walletId;}));
 await page.locator('[data-wallet-archive-action="archive"]').click();
 expect(await page.evaluate(()=>window.clickedWallet)).toBe('w');
 await page.screenshot({path:`test-results/wallet-${width}-${dark}-${native}.png`});
});
