import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../src/features/sport/sportRuntime.js', import.meta.url), 'utf8');

describe('Sport session sandbox view bridge', () => {
  it('exposes the sandbox view through the modular bridge', () => {
    expect(main).toContain("import('./features/sport/sportRuntime.js')");
    expect(runtime).toContain("import * as sportSessionSandboxView from './sportSessionSandboxView.js'");
    expect(runtime).toContain('target.UI.sportSessionSandboxView');
    expect(bridge).not.toContain("import * as sportSessionSandboxView from '../features/sport/sportSessionSandboxView.js'");
  });

  it('delegates sandbox content and refreshed set rows to the modular view', () => {
    expect(sportUi).toContain('window.UI?.sportSessionSandboxView?.renderSandboxContent?.({');
    expect(sportUi).toContain('window.UI?.sportSessionSandboxView?.renderSandboxActions?.({ api: sportViewApi() })');
    expect(sportUi).toContain('window.UI?.sportSessionSandboxView?.renderSandboxSetList?.({ doneSets, plan, api: sportViewApi() })');
    expect(sportUi).not.toContain('const setRowHTML =');
    expect(sportUi).not.toContain('doneSets.map(setRowHTML)');
  });
});
