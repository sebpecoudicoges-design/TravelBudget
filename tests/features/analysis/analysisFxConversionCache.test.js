import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import * as fxRules from '../../../src/core/fxRules.js';

const fx = fs.readFileSync('public/legacy/js/09_fx.js', 'utf8');
const helpers = fs.readFileSync('public/legacy/js/01_helpers.js', 'utf8');
const cache = helpers.slice(helpers.indexOf('const __tbFxCache'), helpers.indexOf('window.tbIsTripBudgetShare ='));

function setup({ segment = null, rates = {}, fallback = 1.8 } = {}) {
  let stored = rates;
  const window = {
    Core: { fxRules },
    state: { period: { baseCurrency: 'AUD', eurBaseRate: fallback }, exchangeRates: {} },
    getBudgetSegmentForDate: () => segment,
  };
  const localStorage = { getItem: () => JSON.stringify(stored) };
  const context = vm.createContext({ window, state: window.state, localStorage, TB_CONST: { LS_KEYS: { eur_rates: 'rates' } }, tbNormalizeDateISO: day => day });
  vm.runInContext(fx + '\n' + cache, context);
  window.fxRatesForSegment = () => window.fxGetEurRates();
  return {
    window, set: rates => { stored = rates; },
    convert: () => vm.runInContext("tbFxConvertForDateCached(10, 'EUR', 'AUD', '2026-11-24')", context),
  };
}

it('does not reuse global rates for the same date after a refresh without a budget segment', () => {
  const { convert, set } = setup({ rates: { AUD: 1.6 } });
  expect(convert()).toBe(16);
  set({ AUD: 1.7 });
  expect(convert()).toBe(17);
});

it('does not equate a missing leg with a cached rate of exactly 1', () => {
  const { convert, set } = setup({ segment: { baseCurrency: 'NZD', fxMode: 'live_ecb' } });
  expect(convert()).toBe(18);
  set({ AUD: 1 });
  expect(convert()).toBe(10);
});

it('re-evaluates the period fallback within the same segment', () => {
  const { convert, window } = setup({ segment: { baseCurrency: 'NZD', fxMode: 'live_ecb' } });
  expect(convert()).toBe(18);
  window.state.period.eurBaseRate = 1.9;
  expect(convert()).toBe(19);
  window.state.period.eurBaseRate = null;
  expect(convert()).toBe(0); // The numeric legacy fallback remains zero; Analyse treats it as unavailable.
});

it('does not remember a missing rate as zero if the cache later supplies that currency', () => {
  const { convert, set } = setup({ fallback: null });
  expect(convert()).toBe(0);
  set({ AUD: 1.6 });
  expect(convert()).toBe(16);
});
