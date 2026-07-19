import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

function loadController() {
  const code = fs.readFileSync('public/legacy/js/11_kpi_controller.js', 'utf8');
  const context = {
    window: { TBKpiView: {} },
    document: {},
    console,
    Number,
    String,
    Array,
    Map,
    Set,
    Object,
    Math,
    Intl,
  };
  vm.runInNewContext(code, context);
  return context.window.TBKpiView;
}

function fakeElement({ value = '', checked = false } = {}) {
  return {
    value,
    checked,
    dataset: {},
    style: {},
    innerHTML: '',
    textContent: '',
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(fn);
    },
    fire(type, event = {}) {
      for (const fn of this.listeners[type] || []) fn({ target: this, ...event });
    },
    click() {
      this.fire('click');
    },
  };
}

function fakeRoot(elements) {
  return {
    querySelector(selector) {
      return elements[selector] || null;
    },
  };
}

function fakeStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.get(key) || '';
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(values.entries());
    },
  };
}

describe('KPI controller', () => {
  const {
    bindKpiFxCalculator,
    bindKpiInteractions,
    bindKpiRangeControls,
    bindKpiScopeSelector,
  } = loadController();

  it('binds range controls without forcing a render until apply', () => {
    const box = fakeElement();
    const start = fakeElement();
    const end = fakeElement();
    const apply = fakeElement();
    const storage = fakeStorage();
    let renderCount = 0;
    let curveReason = '';

    const bound = bindKpiRangeControls({
      root: fakeRoot({
        '#kpiRangeBox': box,
        '#kpiRangeStart': start,
        '#kpiRangeEnd': end,
        '#kpiRangeApply': apply,
      }),
      scope: 'range:2026-07-01:2026-07-10',
      scopeValue: 'range',
      displayDateISO: '2026-07-02',
      parseScope: () => ({ kind: 'range', startISO: '2026-07-01', endISO: '2026-07-10' }),
      resolveRange: () => ({ startISO: '2026-07-01', endISO: '2026-07-10' }),
      storage,
      renderKPI: () => { renderCount += 1; },
      ensureCashflowCurve: (reason) => { curveReason = reason; },
    });

    expect(bound).toBe(true);
    expect(box.style.display).toBe('flex');
    expect(start.value).toBe('2026-07-01');
    expect(end.value).toBe('2026-07-10');

    start.value = '2026-07-03';
    start.fire('change');
    expect(storage.dump().travelbudget_kpi_projection_scope_v1).toBe('range:2026-07-03:2026-07-10');
    expect(renderCount).toBe(0);

    apply.click();
    expect(renderCount).toBe(1);
    expect(curveReason).toBe('kpi-range-change');
  });

  it('stores scope changes and keeps range mode open without rerendering immediately', () => {
    const select = fakeElement({ value: 'segment' });
    const box = fakeElement();
    const start = fakeElement({ value: '2026-07-01' });
    const end = fakeElement({ value: '2026-07-15' });
    const storage = fakeStorage();
    let renderCount = 0;

    bindKpiScopeSelector({
      root: fakeRoot({
        '#kpiScopeSelect': select,
        '#kpiRangeBox': box,
        '#kpiRangeStart': start,
        '#kpiRangeEnd': end,
      }),
      scopeValue: 'segment',
      storage,
      renderKPI: () => { renderCount += 1; },
    });

    select.value = 'range';
    select.fire('change');
    expect(box.style.display).toBe('flex');
    expect(storage.dump().travelbudget_kpi_projection_scope_v1).toBe('range:2026-07-01:2026-07-15');
    expect(renderCount).toBe(0);

    select.value = 'period';
    select.fire('change');
    expect(storage.dump().travelbudget_kpi_projection_scope_v1).toBe('period');
    expect(renderCount).toBe(1);
  });

  it('binds FX calculator currencies, conversion and swap action', () => {
    const amount = fakeElement();
    const from = fakeElement();
    const to = fakeElement();
    const swap = fakeElement();
    const out = fakeElement();
    const storage = fakeStorage({
      travelbudget_fx_calc_amount_v1: '10',
      travelbudget_fx_calc_from_v1: 'EUR',
      travelbudget_fx_calc_to_v1: 'AUD',
    });

    bindKpiFxCalculator({
      root: fakeRoot({
        '#kpiFxCalcAmount': amount,
        '#kpiFxCalcFrom': from,
        '#kpiFxCalcTo': to,
        '#kpiFxCalcSwap': swap,
        '#kpiFxCalcOut': out,
      }),
      state: {
        wallets: [{ currency: 'AUD' }],
        period: { baseCurrency: 'AUD' },
      },
      base: 'AUD',
      storage,
      rates: { AUD: 1.65, USD: 1.08 },
      fxConvert: (value, src, dst) => (src === 'EUR' && dst === 'AUD' ? value * 1.65 : null),
    });

    expect(from.innerHTML).toContain('EUR');
    expect(from.innerHTML).toContain('AUD');
    expect(amount.value).toBe('10');
    expect(out.textContent).toMatch(/^16[,.]5 AUD$/);

    swap.click();
    expect(from.value).toBe('AUD');
    expect(to.value).toBe('EUR');
  });

  it('binds all KPI interactions through one legacy bridge call', () => {
    const elements = {
      '#kpiRangeBox': fakeElement(),
      '#kpiRangeStart': fakeElement(),
      '#kpiRangeEnd': fakeElement(),
      '#kpiRangeApply': fakeElement(),
      '#kpiScopeSelect': fakeElement(),
      '#kpiPeriodSelect': fakeElement(),
      '#kpiFxCalcAmount': fakeElement(),
      '#kpiFxCalcFrom': fakeElement(),
      '#kpiFxCalcTo': fakeElement(),
      '#kpiFxCalcSwap': fakeElement(),
      '#kpiFxCalcOut': fakeElement(),
      '#kpiIncludeUnpaidToggle': fakeElement(),
    };

    const result = bindKpiInteractions({
      root: fakeRoot(elements),
      scope: 'segment',
      scopeValue: 'segment',
      parseScope: () => ({ kind: 'segment' }),
      resolveRange: () => ({ startISO: '2026-07-01', endISO: '2026-07-10' }),
      storage: fakeStorage(),
      state: { period: { baseCurrency: 'EUR' } },
    });

    expect(result).toEqual({ range: true, scope: true, fx: true, toggle: true });
    expect(elements['#kpiPeriodSelect'].dataset.bound).toBe('1');
  });
});
