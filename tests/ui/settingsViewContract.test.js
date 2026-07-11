import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('settings view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/14_settings_periods_ui.js', 'utf8');

  it('exposes the Settings view module to the legacy runtime', () => {
    expect(main).toContain("import * as settingsView from './features/settings/settingsView.js'");
    expect(main).toContain('window.TBSettingsView');
    expect(main).toContain('...settingsView');
  });

  it('keeps legacy Settings wrappers thin and delegated', () => {
    expect(legacy).toContain('window.TBSettingsView?.renderSettingsAccountPanel');
    expect(legacy).toContain('window.TBSettingsView?.getSettingsPanelState');
    expect(legacy).toContain('window.TBSettingsView?.setSettingsPanelState');
    expect(legacy).toContain('window.TBSettingsView?.getSettingsCardSummary');
    expect(legacy).toContain('window.TBSettingsView?.ensureSettingsHero');
    expect(legacy).toContain('window.TBSettingsView?.decorateSettingsPanels');
    expect(legacy).not.toContain('const cards = Array.from(view.querySelectorAll');
    expect(legacy).not.toContain('box.innerHTML = `');
  });
});
