import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../src/features/sport/sportRuntime.js', import.meta.url), 'utf8');

describe('Sport profile view bridge', () => {
  it('loads the Sport profile view with the Sport domain', () => {
    expect(main).toContain("import('./features/sport/sportRuntime.js')");
    expect(runtime).toContain("import * as sportProfileView from './sportProfileView.js'");
    expect(runtime).toContain('target.UI.sportProfileView');
    expect(bridge).not.toContain("import * as sportProfileView from '../features/sport/sportProfileView.js'");
    expect(bridge).not.toContain('window.UI.sportProfileView = sportProfileView');
  });

  it('delegates profile dashboard and body measurement modal rendering to the modular view', () => {
    expect(sportUi).toContain('window.UI?.sportProfileView?.renderSportProfileDashboard?.({');
    expect(sportUi).toContain('window.UI?.sportProfileView?.renderExerciseProgressionAnalysis?.({');
    expect(sportUi).toContain('window.UI?.sportProfileView?.renderBodyMeasurementModal?.({');
    expect(sportUi).toContain('window.UI?.sportProfileView?.bodyMeasurementQuality?.(payload, sportViewApi())');
    expect(sportUi).toContain('data: sportProfileRadarData()');
    expect(sportUi).toContain('buildExerciseProgressionRowsFromSessions?.({');
    expect(sportUi).toContain('buildExerciseProgressionAnalysis?.(analysisRows,');
    expect(sportUi).toContain('editor: CACHE.bodyMeasurementEditor');
    expect(sportUi).not.toContain('function radarPoints(');
    expect(sportUi).not.toContain('function sportProfileAxisBasis(');
    expect(sportUi).not.toContain('const rings = [40, 70, 100]');
  });
});
