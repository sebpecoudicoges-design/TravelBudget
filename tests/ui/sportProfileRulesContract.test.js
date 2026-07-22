import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');

describe('Sport profile rules bridge', () => {
  it('loads the Sport profile rules module with the Sport domain', () => {
    expect(main).toContain("import('./features/sport/sportProfileRules.js')");
    expect(main).toContain('window.Core.sportProfileRules');
    expect(bridge).not.toContain("import * as sportProfileRules from '../features/sport/sportProfileRules.js'");
    expect(bridge).not.toContain('window.Core.sportProfileRules = sportProfileRules');
  });

  it('delegates radar data to pure Sport profile rules', () => {
    expect(sportUi).toContain('window.Core?.sportProfileRules?.buildSportProfileRadarData?.({');
    expect(sportUi).toContain('planForSession: (sessionId) => planFromStoredSession(sessionId)');
    expect(sportUi).toContain('doneSetsForSession: (sessionId) => doneSetsFromStoredSession(sessionId, 0)');
    expect(sportUi).not.toContain('function profileStrengthTargetRatio(');
    expect(sportUi).not.toContain('function profileExerciseCapacity(');
    expect(sportUi).not.toContain('function exerciseProfileBucket(');
  });
});
