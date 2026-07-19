import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');

describe('Sport view extraction bridge', () => {
  it('exposes Sport Timer and History views through the modular bridge', () => {
    const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
    expect(main).toContain("import('./features/sport/sportProgramView.js')");
    expect(bridge).toContain("import * as sportTimerView from '../features/sport/sportTimerView.js'");
    expect(bridge).toContain("import * as sportHistoryView from '../features/sport/sportHistoryView.js'");
    expect(main).toContain('window.UI.sportProgramView');
    expect(bridge).toContain('window.UI.sportTimerView = sportTimerView');
    expect(bridge).toContain('window.UI.sportHistoryView = sportHistoryView');
  });

  it('delegates legacy Sport Timer and History rendering to modular views', () => {
    expect(sportUi).toContain('window.UI?.sportProgramView?.renderPlannedSportWeek?.({');
    expect(sportUi).toContain('window.UI?.sportProgramView?.renderProgramSettings?.({');
    expect(sportUi).toContain('window.UI?.sportTimerView?.renderSportTimer?.({');
    expect(sportUi).toContain('window.UI?.sportHistoryView?.renderSportHistory?.({');
    expect(sportUi).toContain('api: sportViewApi()');
    expect(sportUi).not.toContain('function renderProgramCockpit(');
    expect(sportUi).not.toContain('function programDayOptions(');
    expect(sportUi).not.toContain('function renderTimerTimeline(');
    expect(sportUi).not.toContain('function renderHistoryGrid(');
    expect(sportUi).not.toContain('function renderSessionContent(');
  });
});
