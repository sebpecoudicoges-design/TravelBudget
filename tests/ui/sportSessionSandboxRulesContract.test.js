import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../src/features/sport/sportRuntime.js', import.meta.url), 'utf8');

describe('Sport session sandbox rules bridge', () => {
  it('exposes pure sandbox rules through the modular bridge', () => {
    expect(main).toContain("import('./features/sport/sportRuntime.js')");
    expect(runtime).toContain("import * as sportSessionSandboxRules from './sportSessionSandboxRules.js'");
    expect(runtime).toContain('target.Core.sportSessionSandboxRules');
    expect(bridge).not.toContain("import * as sportSessionSandboxRules from '../features/sport/sportSessionSandboxRules.js'");
  });

  it('delegates set renumbering, deletion and insertion to pure rules', () => {
    expect(sportUi).toContain('window.Core?.sportSessionSandboxRules || {}');
    expect(sportUi).toContain('sandboxRules.normalizeSandboxSetIndexes?.(doneSets)');
    expect(sportUi).toContain('sandboxRules.removeSandboxSet?.({ plan, doneSets: readNextSets(), index: idx })');
    expect(sportUi).toContain('sandboxRules.addSandboxSetToExercise?.({');
    expect(sportUi).not.toContain('const normalizeSetIndexes =');
    expect(sportUi).not.toContain('const counters = new Map();');
  });
});
