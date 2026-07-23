import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');

describe('Sport view extraction bridge', () => {
  it('loads Sport Timer and History views with the Sport domain', () => {
    const runtime = readFileSync(new URL('../../src/features/sport/sportRuntime.js', import.meta.url), 'utf8');
    expect(main).toContain("import('./features/sport/sportRuntime.js')");
    expect(runtime).toContain("import * as sportProgramView from './sportProgramView.js'");
    expect(runtime).toContain("import * as sportTimerView from './sportTimerView.js'");
    expect(runtime).toContain("import * as sportHistoryView from './sportHistoryView.js'");
    expect(runtime).toContain('target.UI.sportProgramView');
    expect(runtime).toContain('target.UI.sportTimerView');
    expect(runtime).toContain('target.UI.sportHistoryView');
    expect(bridge).not.toContain("import * as sportTimerView from '../features/sport/sportTimerView.js'");
    expect(bridge).not.toContain("import * as sportHistoryView from '../features/sport/sportHistoryView.js'");
  });

  it('delegates legacy Sport Timer and History rendering to modular views', () => {
    expect(sportUi).toContain('window.UI?.sportProgramView?.renderPlannedSportWeek?.({');
    expect(sportUi).toContain('window.UI?.sportProgramView?.renderProgramSettings?.({');
    expect(sportUi).toContain('window.UI?.sportTimerView?.renderSportTimer?.({');
    expect(sportUi).toContain('window.UI?.sportTimerView?.renderFreeTimer?.({');
    expect(sportUi).toContain('window.UI?.sportTimerView?.renderFinishWorkoutModal?.({');
    expect(sportUi).toContain('window.UI?.sportHistoryView?.renderSportHistory?.({');
    expect(sportUi).toContain('api: sportViewApi()');
    expect(sportUi).not.toContain('function renderProgramCockpit(');
    expect(sportUi).not.toContain('function programDayOptions(');
    expect(sportUi).not.toContain('function renderTimerTimeline(');
    expect(sportUi).not.toContain('id="sport-free-start"');
    expect(sportUi).not.toContain('function renderHistoryGrid(');
    expect(sportUi).not.toContain('function renderSessionContent(');
    expect(sportUi).not.toContain('id="sport-finish-notes" rows="3"');
  });
});
