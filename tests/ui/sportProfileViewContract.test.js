import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');

describe('Sport profile view bridge', () => {
  it('exposes the Sport profile view through the modular bridge', () => {
    expect(bridge).toContain("import * as sportProfileView from '../features/sport/sportProfileView.js'");
    expect(bridge).toContain('window.UI.sportProfileView = sportProfileView');
  });

  it('delegates profile dashboard and body measurement modal rendering to the modular view', () => {
    expect(sportUi).toContain('window.UI?.sportProfileView?.renderSportProfileDashboard?.({');
    expect(sportUi).toContain('window.UI?.sportProfileView?.renderBodyMeasurementModal?.({');
    expect(sportUi).toContain('data: sportProfileRadarData()');
    expect(sportUi).toContain('editor: CACHE.bodyMeasurementEditor');
    expect(sportUi).not.toContain('function radarPoints(');
    expect(sportUi).not.toContain('function sportProfileAxisBasis(');
    expect(sportUi).not.toContain('const rings = [40, 70, 100]');
  });
});
