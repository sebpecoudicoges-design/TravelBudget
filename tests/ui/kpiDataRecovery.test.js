import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/legacy/js/07_supabase_bootstrap.js', 'utf8');
const domains = [
  { name: 'activity', load: 'tbEnsureActivityData', pending: '__TB_ACTIVITY_LOAD_PROMISE__', flag: 'activityDataLoaded' },
  { name: 'nutrition', load: 'tbEnsureNutritionKpiData', pending: '__TB_NUTRITION_KPI_LOAD_PROMISE__', flag: 'nutritionKpiDataLoaded' },
];

function setup() {
  let result = () => Promise.resolve({ data: [], error: null });
  const from = vi.fn(() => {
    const query = {};
    for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'in']) query[method] = () => query;
    query.then = (resolve, reject) => result().then(resolve, reject);
    return query;
  });
  const window = {
    state: {}, sbUser: { id: 'test-user' }, sb: { from },
    TB_CONST: { TABLES: Object.fromEntries(['sport_sessions', 'work_days', 'nutrition_meals', 'nutrition_sleep', 'nutrition_meal_items'].map(key => [key, key])) },
    addEventListener() {}, dispatchEvent: vi.fn(), renderKPI: vi.fn(),
  };
  vm.runInNewContext(source, { window, navigator: { onLine: true }, console, CustomEvent: class {} });
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
});
