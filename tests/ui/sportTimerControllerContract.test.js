import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../src/features/sport/sportRuntime.js', import.meta.url), 'utf8');

describe('Sport timer controller bridge', () => {
  it('loads timer controller with the Sport domain', () => {
    expect(main).toContain("import('./features/sport/sportRuntime.js')");
    expect(runtime).toContain("import * as sportTimerController from './sportTimerController.js'");
    expect(runtime).toContain('target.UI.sportTimerController');
    expect(bridge).not.toContain("import * as sportTimerController from '../features/sport/sportTimerController.js'");
  });

  it('delegates timer actions to the controller instead of low-level sport rules', () => {
    expect(sportUi).toContain('window.UI?.sportTimerController?.createTimerState');
    expect(sportUi).toContain('window.UI?.sportTimerController?.completeTimerStep');
    expect(sportUi).toContain('window.UI?.sportTimerController?.addSetForCurrentExercise');
    expect(sportUi).toContain('window.UI?.sportTimerController?.addCircuitRound');
    expect(sportUi).toContain('window.UI?.sportTimerController?.togglePause');
    expect(sportUi).not.toContain('window.Core?.sportRules?.insertExerciseSet');
    expect(sportUi).not.toContain('window.Core?.sportRules?.appendCircuitRound');
  });
});
