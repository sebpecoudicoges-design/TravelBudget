import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');

describe('Sport timer controller bridge', () => {
  it('exposes timer controller through the modular bridge', () => {
    expect(bridge).toContain("import * as sportTimerController from '../features/sport/sportTimerController.js'");
    expect(bridge).toContain('window.UI.sportTimerController = sportTimerController');
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
