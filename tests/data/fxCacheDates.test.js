import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';

const source = fs.readFileSync('public/legacy/js/09_fx.js', 'utf8');
function setup() {
  const storage = new Map([['eur_rates', JSON.stringify({ EUR: 1, CAD: 1.5 })]]);
  let result;
  const state = { period: { baseCurrency: 'EUR' }, exchangeRates: {} };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const sb = { functions: { invoke: async () => result }, from: () => ({ update: () => ({ eq: async () => ({}) }) }) };
  const context = vm.createContext({
    window: { state }, state, sb, sbUser: {}, alert() {}, console, localStorage,
    TB_CONST: { LS_KEYS: Object.fromEntries(['eur_rates', 'eur_rates_asof', 'eur_rates_keys', 'fx_last_daily'].map(key => [key, key])), TABLES: { periods: 'periods' } },
    refreshFromServer: async () => {}, toLocalISODate: () => '2026-11-26',
  });
  vm.runInContext(source, context);
  return { storage, context, set: data => { result = { data }; } };
}

it('keeps individual provider dates across automatic and manual partial refreshes', async () => {
  const { context, set } = setup();
  set({ source: 'frankfurter_v2', date: '2026-11-26', rates: { EUR: 1, AUD: 1.7, NZD: 1.9 }, rate_dates: { AUD: '2026-11-24', NZD: '2026-11-26', CAD: '2026-11-25' } });
  await vm.runInContext('tbFxEnsureDaily()', context);
  expect(vm.runInContext('tbFxAutoStatus().rateDates', context)).toEqual({ AUD: '2026-11-24', NZD: '2026-11-26' });

  set({ source: 'frankfurter_v2', date: '2026-11-27', rates: { EUR: 1, NZD: 1.9, JPY: 178, GBP: 0.87 }, rate_dates: { JPY: '2026-11-27', GBP: '2026-02-31' } });
  await vm.runInContext('refreshFxRates()', context);
  expect(vm.runInContext('tbFxAutoStatus().rateDates', context)).toEqual({ AUD: '2026-11-24', JPY: '2026-11-27' });
  expect(vm.runInContext('_fxGetEurRates()', context)).toEqual({ EUR: 1, CAD: 1.5, AUD: 1.7, NZD: 1.9, JPY: 178, GBP: 0.87 });
});

it('never assigns a batch date to an older payload, or dates a new rate that failed to persist', async () => {
  const { context, storage, set } = setup();
  set({ date: '2026-11-26', rates: { CAD: 1.7 }, rate_dates: { CAD: '2026-11-26' } });
  await vm.runInContext('refreshFxRates()', context);
  expect(vm.runInContext('tbFxAutoStatus().rateDates', context)).toEqual({});
  const before = storage.get('eur_rates');
  context.localStorage.setItem = (key, value) => {
    if (key === 'eur_rates') throw new Error('quota');
    storage.set(key, value);
  };
  set({ source: 'frankfurter_v2', date: '2026-11-27', rates: { CAD: 1.8 }, rate_dates: { CAD: '2026-11-27' } });
  await vm.runInContext('refreshFxRates()', context);
  expect(storage.get('eur_rates')).toBe(before);
  expect(vm.runInContext('tbFxAutoStatus().rateDates', context)).toEqual({});
});

it('tracks the selected table origin even when manual, provider and fixed rates are equal', () => {
  const { storage, context } = setup();
  const stateSource = fs.readFileSync('public/legacy/js/05_state.js', 'utf8');
  const segmentBuilder = stateSource.slice(stateSource.indexOf('function fxRatesForSegment('), stateSource.indexOf('const __tbBudgetBaseCache'));
  vm.runInContext(segmentBuilder, context);
  storage.set('eur_rates', JSON.stringify({ EUR: 1, AUD: 1.7, CAD: 1.5, _rateDates: { AUD: '2026-11-24', NZD: '2026-11-27' } }));
  context.state.fx = { manualRates: { AUD: { rate: 1.7, asOf: '2026-11-26' }, NZD: { rate: 1.9, asOf: '2026-11-25' } } };
  const read = code => vm.runInContext(code, context);

  const snapshot = read('window.tbFxRateTable()');
  expect(snapshot.rates).toEqual(read('window.fxGetEurRates()'));
  expect(snapshot.origins).toEqual({
    EUR: { kind: 'pivot' }, CAD: { kind: 'automatic', asOf: null }, AUD: { kind: 'automatic', asOf: '2026-11-24' }, NZD: { kind: 'manual', asOf: '2026-11-25' },
  });
  const segment = "{ baseCurrency: 'AUD', eurBaseRateFixed: 1.7 }";
  const fixed = read(`fxRatesForSegment(${segment}, true)`);
  expect(fixed.rates).toEqual(read(`fxRatesForSegment(${segment})`));
  expect(fixed.origins.AUD).toEqual({ kind: 'fixed' });
  expect(fixed.origins.NZD).toEqual({ kind: 'manual', asOf: '2026-11-25' });
  expect(read("fxRatesForSegment({ baseCurrency: 'AUD', fxMode: 'live_ecb', eurBaseRateFixed: 1.7 }, true).origins.AUD")).toEqual({ kind: 'automatic', asOf: '2026-11-24' });
  context.state.period = { baseCurrency: 'AUD', eurBaseRate: 1.7 };
  expect(read("fxRatesForSegment({ baseCurrency: 'AUD' }, true).origins.AUD")).toEqual({ kind: 'period' });
});
