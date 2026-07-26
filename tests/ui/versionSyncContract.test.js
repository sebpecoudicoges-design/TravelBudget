import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageData = JSON.parse(read('package.json'));

describe('version synchronization', () => {
  it('keeps browser, service worker and legacy fallbacks aligned with package.json', () => {
    const version = packageData.version;
    expect(read('index.html')).toContain(`window.TB_VERSION = window.__TB_BUILD = "${version}";`);
    expect(read('public/legacy/js/00_constants.js')).toContain(`window.TB_VERSION = window.TB_VERSION || "${version}";`);
    expect(read('public/sw.js')).toContain(`const TB_SW_VERSION = "travelbudget-pwa-${version}";`);
  });

  it('derives Android versionName and versionCode from package.json', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('file("../../package.json")');
    expect(gradle).toContain('versionName appVersionName');
    expect(gradle).toContain('versionCode appVersionCode');
  });
});
