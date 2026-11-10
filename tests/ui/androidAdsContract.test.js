import { expect, it } from 'vitest';
import fs from 'node:fs';

it('keeps advertising native-only and debug APKs on demo units',()=>{
  const main=fs.readFileSync('src/main.js','utf8');
  expect(main).toContain("window.Capacitor?.getPlatform?.() === 'android'");
  expect(main).toContain("deferredModules.load('nativeAds')");
  expect(main).toContain('window.setTimeout(close, 5000)');
  const native=fs.readFileSync('android/app/src/main/java/com/travelbudget/app/TravelBudgetAdsPlugin.java','utf8');
  expect(native).toContain('ApplicationInfo.FLAG_DEBUGGABLE');
  const runtime=fs.readFileSync('src/app/nativeAds.js','utf8');
  expect(runtime).toContain("const ids = testing ?");
  expect(runtime).toContain('ca-app-pub-3940256099942544/9257395921');
  expect(runtime).toContain('ca-app-pub-3940256099942544/9214589741');
  expect(runtime).not.toMatch(/sbUser|transactions|wallets|meals|documents/);
  const privacy=fs.readFileSync('public/privacy.html','utf8');
  expect(privacy).not.toContain('n’affiche pas de publicité');
  expect(privacy).toContain('Google AdMob');
});
