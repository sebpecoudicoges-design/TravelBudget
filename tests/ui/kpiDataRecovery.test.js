import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/legacy/js/07_supabase_bootstrap.js', 'utf8');
const domains = [
  { name: 'activity', load: 'tbEnsureActivityData', pending: '__TB_ACTIVITY_LOAD_PROMISE__', flag: 'activityDataLoaded', rows: 'sportSessions' },
  { name: 'nutrition', load: 'tbEnsureNutritionKpiData', pending: '__TB_NUTRITION_KPI_LOAD_PROMISE__', flag: 'nutritionKpiDataLoaded', rows: 'nutritionMeals' },
];

function setup() {
  let result = () => Promise.resolve({ data: [], error: null });
  const from = vi.fn((table) => {
    const query = {};
    for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'in']) query[method] = () => query;
    query.then = (resolve, reject) => result(table).then(resolve, reject);
    return query;
  });
  const listeners = new Map();
  const window = {
    state: {}, sbUser: { id: 'test-user' }, sb: { from },
    TB_CONST: { TABLES: Object.fromEntries(['sport_sessions', 'work_days', 'nutrition_meals', 'nutrition_sleep', 'nutrition_meal_items'].map(key => [key, key])) },
    addEventListener(name, fn) { listeners.set(name, fn); },
    dispatchEvent: vi.fn(event => listeners.get(event.type)?.(event)), renderKPI: vi.fn(), tbSaveOfflineSnapshot: vi.fn(),
  };
  vm.runInNewContext(source, { window, navigator: { onLine: true }, console, CustomEvent: class { constructor(type) { this.type = type; } } });
  return { window, from, respond: fn => { result = fn; } };
}

describe.each(domains)('$name KPI data recovery', domain => {
  it('retries the network after a failed load and caches only successful data', async () => {
    const { window, from, respond } = setup();
    respond(() => Promise.resolve({ error: new Error('network unavailable') }));
    await expect(window[domain.load]()).rejects.toThrow('network unavailable');
    expect(window[domain.pending]).toBeNull();
    expect(window.state[domain.flag]).not.toBe(true);
    respond(() => Promise.resolve({ data: [], error: null }));
    await expect(window[domain.load]()).resolves.toMatchObject({ loaded: true });
    expect(window.state[domain.flag]).toBe(true);
    expect(from).toHaveBeenCalledTimes(4);
    await expect(window[domain.load]()).resolves.toMatchObject({ cached: true });
    expect(from).toHaveBeenCalledTimes(4);
  });

  it('does not retain a skipped pre-authentication load', async () => {
    const { window, from } = setup();
    window.sbUser = null;
    await expect(window[domain.load]()).resolves.toMatchObject({ skipped: true });
    expect(window[domain.pending]).toBeNull();
    window.sbUser = { id: 'test-user' };
    await expect(window[domain.load]()).resolves.toMatchObject({ loaded: true });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('shares in-flight requests and does not clear a newer forced load', async () => {
    const { window, from, respond } = setup();
    const releases = [];
    respond(() => new Promise(resolve => releases.push(resolve)));
    const first = window[domain.load]();
    const shared = window[domain.load]();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    const forced = window[domain.load]({ force: true });
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    const current = window[domain.pending];
    releases.slice(0, 2).forEach(resolve => resolve({ data: [], error: null }));
    await Promise.all([first, shared]);
    expect(window[domain.pending]).toBe(current);
    releases.slice(2).forEach(resolve => resolve({ data: [], error: null }));
    await forced;
    expect(window[domain.pending]).toBeNull();
    expect(from).toHaveBeenCalledTimes(4);
  });

  it('retries after an offline skip without issuing requests while offline', async () => {
    const { window, from } = setup();
    window.tbShouldUseOfflineMode = async () => true;
    await expect(window[domain.load]()).resolves.toMatchObject({ skipped: true, reason: 'offline' });
    expect(from).not.toHaveBeenCalled();
    window.tbShouldUseOfflineMode = async () => false;
    await expect(window[domain.load]()).resolves.toMatchObject({ loaded: true });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('clears cached data on account change and starts a fresh load', async () => {
    const { window, respond, from } = setup();
    respond(() => Promise.resolve({ data: [{ label: 'old account' }], error: null }));
    await window[domain.load]();
    window.sbUser = { id: 'new-user' };
    window.dispatchEvent({ type: 'tb:auth_scope_changed' });
    expect(window.state[domain.flag]).toBe(false);
    expect(window.state[domain.rows]).toEqual([]);
    respond(() => Promise.resolve({ data: [], error: null }));
    await expect(window[domain.load]()).resolves.toMatchObject({ loaded: true });
    expect(from).toHaveBeenCalledTimes(4);
  });

  it.each(['switch', 'logout', 'same-user-return', 'state-replaced', 'forced'])('ignores obsolete responses after %s, including snapshot and render effects', async transition => {
    const { window, respond } = setup();
    const releases = [];
    respond(() => new Promise(resolve => releases.push(resolve)));
    const oldLoad = window[domain.load]();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    if (transition === 'state-replaced') window.state = {};
    else if (transition !== 'forced') {
      window.sbUser = transition === 'logout' ? null : { id: 'new-user' };
      window.dispatchEvent({ type: 'tb:auth_scope_changed' });
      if (transition === 'same-user-return') {
        window.sbUser = { id: 'test-user' };
        window.dispatchEvent({ type: 'tb:auth_scope_changed' });
      }
    }
    if (transition !== 'logout') {
      respond(() => Promise.resolve({ data: [{ label: 'current account' }], error: null }));
      await expect(window[domain.load]({ force: transition === 'forced' || transition === 'state-replaced' })).resolves.toMatchObject({ loaded: true });
    }
    window.tbSaveOfflineSnapshot.mockClear();
    window.renderKPI.mockClear();
    window.dispatchEvent.mockClear();
    releases.forEach(resolve => resolve({ data: [{ label: 'old account' }], error: null }));
    await expect(oldLoad).resolves.toMatchObject({ loaded: false, skipped: true, reason: 'stale-scope' });
    expect(window.state[domain.rows] || []).toEqual(transition === 'logout' ? [] : [expect.objectContaining({ label: 'current account' })]);
    expect(window.tbSaveOfflineSnapshot).not.toHaveBeenCalled();
    expect(window.renderKPI).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('does not start queries if the account changes during the offline check', async () => {
    const { window, from } = setup();
    let release;
    window.tbShouldUseOfflineMode = () => new Promise(resolve => { release = resolve; });
    const oldLoad = window[domain.load]();
    window.sbUser = { id: 'new-user' };
    window.dispatchEvent({ type: 'tb:auth_scope_changed' });
    release(false);
    await expect(oldLoad).resolves.toMatchObject({ reason: 'stale-scope' });
    expect(from).not.toHaveBeenCalled();
  });

  it('ignores a late network rejection from the previous account', async () => {
    const { window, respond } = setup();
    const rejects = [];
    respond(() => new Promise((resolve, reject) => rejects.push(reject)));
    const oldLoad = window[domain.load]();
    await vi.waitFor(() => expect(rejects).toHaveLength(2));
    window.sbUser = null;
    window.dispatchEvent({ type: 'tb:auth_scope_changed' });
    rejects.forEach(reject => reject(new Error('old request failed')));
    await expect(oldLoad).resolves.toMatchObject({ reason: 'stale-scope' });
    expect(window.tbSaveOfflineSnapshot).not.toHaveBeenCalled();
    expect(window.renderKPI).not.toHaveBeenCalled();
  });
});

it('discards Nutrition items arriving after an account switch between query stages', async () => {
  const { window, respond } = setup();
  let releaseItems;
  respond(table => table === 'nutrition_meal_items'
    ? new Promise(resolve => { releaseItems = resolve; })
    : Promise.resolve({ data: table === 'nutrition_meals' ? [{ id: 'old-meal' }] : [], error: null }));
  const oldLoad = window.tbEnsureNutritionKpiData();
  await vi.waitFor(() => expect(releaseItems).toBeTypeOf('function'));
  window.sbUser = { id: 'new-user' };
  window.dispatchEvent({ type: 'tb:auth_scope_changed' });
  respond(() => Promise.resolve({ data: [], error: null }));
  await window.tbEnsureNutritionKpiData();
  window.tbSaveOfflineSnapshot.mockClear();
  releaseItems({ data: [{ meal_id: 'old-meal', label: 'private old item' }], error: null });
  await expect(oldLoad).resolves.toMatchObject({ reason: 'stale-scope' });
  expect(window.state.nutritionMealItems).toEqual([]);
  expect(window.tbSaveOfflineSnapshot).not.toHaveBeenCalled();
});
