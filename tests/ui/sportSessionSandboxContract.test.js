import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');

describe('Sport session sandbox view bridge', () => {
  it('exposes the sandbox view through the modular bridge', () => {
    expect(bridge).toContain("import * as sportSessionSandboxView from '../features/sport/sportSessionSandboxView.js'");
    expect(bridge).toContain('window.UI.sportSessionSandboxView = sportSessionSandboxView');
  });

  it('delegates sandbox content and refreshed set rows to the modular view', () => {
    expect(sportUi).toContain('window.UI?.sportSessionSandboxView?.renderSandboxContent?.({');
    expect(sportUi).toContain('window.UI?.sportSessionSandboxView?.renderSandboxActions?.({ api: sportViewApi() })');
    expect(sportUi).toContain('window.UI?.sportSessionSandboxView?.renderSandboxSetList?.({ doneSets, plan, api: sportViewApi() })');
    expect(sportUi).not.toContain('const setRowHTML =');
    expect(sportUi).not.toContain('doneSets.map(setRowHTML)');
  });
});
