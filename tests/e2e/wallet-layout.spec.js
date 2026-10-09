import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const styles=[...fs.readFileSync('index.html','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
for(const width of [1440,900,600,390]) for(const dark of [false,true]) for(const native of [false,true]) test(`wallet actions contained ${width} dark=${dark} native=${native}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.route('**/wallet-layout-test',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body class="tb-view-dashboard ${dark?'theme-dark':''} ${native?'tb-capacitor-app':''}"><main id="view-dashboard"><div id="wallets-list" style="width:min(100%,360px)"><div class="wallet wallet-item"></div></div></main></body></html>`}));
 await page.goto('/wallet-layout-test');await page.addStyleTag({url:'/src/ui/premium-theme.css'});
 await page.evaluate(async()=>{
 const {renderWalletCard}=await import('/src/features/dashboard/dashboardView.js');
 document.querySelector('.wallet-item').innerHTML=renderWalletCard({wallet:{id:'w',name:'Banque Australie',currency:'AUD'},balance:'1234,56 AUD',t:k=>({'wallet.action.archive':'Archiver ce portefeuille' ,'wallet.action.add_expense':'Ajouter une dépense','wallet.action.add_income':'Ajouter un revenu'}[k]||k)});
 });
 const failures=await page.locator('.tb-wallet-action-col').evaluate(panel=>{
 const p=panel.getBoundingClientRect(),card=panel.closest('.wallet-item').getBoundingClientRect();
 return [...panel.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.left<p.left||r.right>p.right+1||r.bottom>p.bottom+1||r.bottom>card.bottom+1||r.right>card.right+1;}).map(b=>b.textContent);
 });expect(failures).toEqual([]);
 await page.evaluate(()=>document.querySelector('.wallet-item').addEventListener('click',e=>{window.clickedWallet=e.target.dataset.walletId;}));
 await page.locator('[data-wallet-archive-action]').click();
 expect(await page.evaluate(()=>window.clickedWallet)).toBe('w');
 await page.screenshot({path:`test-results/wallet-${width}-${dark}-${native}.png`});
});
