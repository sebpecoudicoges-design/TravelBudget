import { test, expect } from '@playwright/test';
import fs from 'node:fs';

for (const width of [1440,390]) for (const theme of ['light','dark']) {
  test(`Android launch and privacy controls ${width} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.route('**/ads-layout-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body><main><button id="underlying">Continuer</button></main><div class="tb-ad-launch" role="status">TravelBudget</div></body>'}));
    await page.goto('/ads-layout-test');
    await page.addStyleTag({url:'/src/ui/premium-theme.css'});
    await page.evaluate(theme=>{document.body.classList.toggle('theme-dark',theme==='dark');document.documentElement.dataset.theme=theme;},theme);
    await expect(page.getByRole('status')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const button=fs.readFileSync('index.html','utf8').match(/<button id="tb-ad-privacy"[^>]*>[^<]*<\/button>/)[0];
    await page.evaluate(html=>{document.querySelector('.tb-ad-launch').remove();document.querySelector('main').insertAdjacentHTML('beforeend',html);},button);
    await expect(page.locator('#tb-ad-privacy')).toBeHidden();
    await page.evaluate(()=>{document.getElementById('tb-ad-privacy').hidden=false;});
    await expect(page.locator('#tb-ad-privacy')).toBeVisible();
    await page.locator('#tb-ad-privacy').click();
    const status=fs.readFileSync('index.html','utf8').match(/<p id="tb-ad-status"[^>]*><\/p>/)[0];
    await page.evaluate(html=>{
      document.querySelector('main').insertAdjacentHTML('beforeend',html);
      const output=document.getElementById('tb-ad-status');
      output.hidden=false;
      output.textContent='Publicité : indisponible — Consent configuration error. '+ 'x'.repeat(220);
    },status);
    await expect(page.locator('#tb-ad-status')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('#underlying')).toBeVisible();
  });
}
