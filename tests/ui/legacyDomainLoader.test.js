import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('legacy domain loader', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const navigation = fs.readFileSync('public/legacy/js/10_navigation.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');

  it('keeps Assets out of the boot legacy list and registers it as a deferred domain', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/41_assets_core.js');
    expect(bootList).not.toContain('/legacy/js/42_assets_ui.js');
    expect(domains).toContain('assets:');
    expect(domains).toContain('/legacy/js/41_assets_core.js');
    expect(domains).toContain('/legacy/js/42_assets_ui.js');
    expect(main).toContain('window.tbLoadLegacyDomain');
  });

  it('loads the Assets domain before rendering the Assets view when needed', () => {
    expect(navigation).toContain('window.tbLoadLegacyDomain("assets")');
    expect(navigation).toContain('renderAssets("navigation:lazy")');
  });

  it('keeps Nutrition out of boot and lazy-loads it before rendering the Nutrition view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/48_nutrition_ui.js');
    expect(domains).toContain('nutrition:');
    expect(domains).toContain('/legacy/js/48_nutrition_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("nutrition")');
    expect(navigation).toContain('renderNutrition("navigation:lazy")');
    expect(index).toContain('id="tab-nutrition"');
    expect(index).toContain('id="view-nutrition"');
    expect(index).toContain('id="nutrition-root"');
  });
});
