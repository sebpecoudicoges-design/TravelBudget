import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sportUi = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../../src/app/bridge.js', import.meta.url), 'utf8');

describe('Sport store legacy bridge', () => {
  it('exposes the Sport store factory through the modular bridge', () => {
    expect(bridge).toContain("import { createSportStore } from '../features/sport/sportStore.js'");
    expect(bridge).toContain('window.Data.createSportStore = window.Data.createSportStore || createSportStore');
  });

  it('uses entityStore-backed hydration for local, offline and remote state', () => {
    expect(sportUi).toContain('createSportStore({}, { entityStore: window.Data?.appStore, namespace: "sport" })');
    expect(sportUi).toContain('sportStore.hydrateScope({');
    expect(sportUi).toContain('sportStore.hydrateOffline(state || {})');
    expect(sportUi).toContain('sportStore.hydrateRemote(history, Array.from(pendingDeletes))');
    expect(sportUi).toContain('Object.assign(state, sportStore.appSnapshot())');
  });

  it('persists critical Sport caches through the quota-aware writer', () => {
    expect(sportUi).toContain('persistSportCache(PLAN_KEY(), JSON.stringify(rows))');
    expect(sportUi).toContain('persistSportCache(HISTORY_KEY(), JSON.stringify(clean))');
    expect(sportUi).toContain('persistSportCache(DELETE_QUEUE_KEY(), JSON.stringify(clean))');
  });
});
