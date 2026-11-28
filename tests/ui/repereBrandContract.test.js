import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(name, 'utf8');

it('uses the name-independent Repère for the app shell and standalone PWA', () => {
  const svg = read('public/pwa-icon.svg');
  expect(svg).toContain('M100 151C92 142');
  expect(svg).toContain('stroke="#78F1CB"');
  expect(svg).not.toMatch(/<text[\s>]/i);
  const html = read('index.html');
  expect(html).toContain('class="tb-app-brand-icon" src="/pwa-icon.svg" width="40" height="40" alt=""');
  expect(html).not.toContain('content:"BP"');
  const bootLogo = 'class="tb-boot-mark" src="/pwa-icon.svg" width="46" height="46" alt=""';
  expect(html).toContain(bootLogo);
  expect(read('public/legacy/js/20_boot.js')).toContain(bootLogo);
  expect(html).toContain('href="/apple-touch-icon.png"');
  expect(read('public/offline.html')).toContain('src="/pwa-icon.svg"');
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  expect(manifest.short_name).toBe('TravelBudget');
  for (const [src, size] of [['/apple-touch-icon.png', 180], ['/pwa-icon-192.png', 192], ['/pwa-icon-512.png', 512]]) {
    const data = readFileSync('public' + src);
    expect(data.subarray(1,4).toString()).toBe('PNG');
    expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([size, size]);
    if (size !== 180) expect(manifest.icons).toContainEqual(expect.objectContaining({ src, sizes: `${size}x${size}`, purpose: 'any maskable' }));
  }
});

it('shares the Repère field between adaptive Android launcher and splash', () => {
  const root = 'android/app/src/main/res/';
  expect(read(root + 'values/ic_launcher_background.xml')).toContain('#0D4247');
  expect(read(root + 'values/styles.xml')).toContain('name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground');
  for (const [density, legacy, adaptive] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]) {
    for (const [suffix, size] of [['',legacy],['_round',legacy],['_foreground',adaptive]]) {
      const data = readFileSync(root + `mipmap-${density}/ic_launcher${suffix}.png`);
      expect(data.subarray(1,4).toString()).toBe('PNG');
      expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([size,size]);
    }
  }
});
