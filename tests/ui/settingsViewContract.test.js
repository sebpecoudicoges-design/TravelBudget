import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('settings view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/14_settings_periods_ui.js', 'utf8');

  it('exposes the Settings view module to the legacy runtime', () => {
    expect(main).toContain("import * as settingsView from './features/settings/settingsView.js'");
    expect(main).toContain("import * as settingsAccountController from './features/settings/settingsAccountController.js'");
    expect(main).toContain('window.TBSettingsView');
    expect(main).toContain('...settingsView');
    expect(main).toContain('window.TBLoadSettingsCategoriesView');
    expect(main).toContain("import('./features/settings/settingsCategoriesView.js')");
    expect(main).toContain('window.TBSettingsAccountController');
    expect(main).toContain('...settingsAccountController');
  });

  it('keeps legacy Settings wrappers thin and delegated', () => {
    expect(legacy).toContain('window.TBSettingsView?.renderSettingsAccountPanel');
    expect(legacy).toContain('window.TBSettingsView?.normalizeManualFxRates');
    expect(legacy).toContain('window.TBSettingsView?.renderSettingsManualFxPanel');
    expect(legacy).toContain('window.TBSettingsView?.renderSettingsPeriodCard');
    expect(legacy).toContain('window.TBSettingsView?.renderSettingsPeriodReference');
    expect(legacy).toContain('window.TBSettingsView?.renderSettingsTravelOverview');
    expect(legacy).toContain('window.TBSettingsView?.renderCreateVoyageModalBody');
    expect(legacy).toContain('window.TBSettingsView?.renderCreatePeriodModalBody');
    expect(legacy).toContain('window.TBSettingsView?.getBudgetSegmentDeleteReadiness');
    expect(legacy).toContain('window.TBSettingsAccountController?.bindSettingsAccountPanel');
    expect(legacy).toContain('window.TBSettingsView?.getSettingsPanelState');
    expect(legacy).toContain('window.TBSettingsView?.setSettingsPanelState');
    expect(legacy).toContain('window.TBSettingsView?.getSettingsCardSummary');
    expect(legacy).toContain('window.TBSettingsView?.ensureSettingsHero');
    expect(legacy).toContain('window.TBSettingsView?.decorateSettingsPanels');
    expect(legacy).toContain('window.TBLoadSettingsCategoriesView');
    expect(legacy).toContain('window.TBSettingsCategoriesView?.renderSettingsCategoriesList');
    expect(legacy).toContain('window.TBSettingsCategoriesView?.renderGuidedCategoryModalBody');
    expect(legacy).toContain('window.TBSettingsCategoriesView?.renderGuidedSubcategoryModalBody');
    expect(legacy).toContain('window.TBSettingsCategoriesView?.validateCategoryDraft');
    expect(legacy).toContain('window.TBSettingsCategoriesView?.validateSubcategoryDraft');
    expect(legacy).not.toContain('const cards = Array.from(view.querySelectorAll');
    expect(legacy).not.toContain('box.innerHTML = `');
    expect(legacy).not.toContain('const readNotificationForm = () =>');
    expect(legacy).not.toContain('const _rememberAccount =');
    expect(legacy).not.toContain('manualPanel.innerHTML = `');
    expect(legacy).not.toContain('<button type="button" class="tb-period-head"');
    expect(legacy).not.toContain('function renderManualFxBox');
    expect(legacy).not.toContain('function tbManualFxAdd');
    expect(legacy).not.toContain('function tbManualFxDel');
    expect(legacy).not.toContain('tb-period-compare tb-period-compare--minimal');
    expect(legacy).not.toContain('tb-v11-travel-hero tb-v11-travel-hero--minimal');
    expect(legacy).not.toContain('<div class="tb-subcat-row">');
    expect(legacy).not.toContain('<details class="tb-category-card"');
    expect(legacy).not.toContain('<input id="tb-cat-create-name"');
    expect(legacy).not.toContain('<input id="tb-subcat-create-name"');
    expect(legacy).not.toContain('<input id="tb-vstart"');
    expect(legacy).not.toContain('<input id="tb-pstart"');
    expect(legacy).not.toContain('const duplicate = existingRows.find');
    expect(legacy).not.toContain('const duplicateSql = existingRows.find');
  });
});
