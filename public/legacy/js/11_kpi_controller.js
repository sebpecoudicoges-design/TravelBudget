/* KPI interaction controller. Kept as a tiny legacy bridge to avoid growing lazy Vite chunks. */
(function(){
function noop() {}

function defaultFmtOut(value, currency) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  const s = (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${s} ${currency}`;
}

function safeSetItem(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch (_) {}
}

function safeGetItem(storage, key) {
  try {
    return storage?.getItem?.(key) || '';
  } catch (_) {
    return '';
  }
}

function resolveScopeKey(constants) {
  return constants?.LS_KEYS?.kpi_projection_scope || 'travelbudget_kpi_projection_scope_v1';
}

function refreshVisuals({ renderKPI = noop, ensureCashflowCurve, requestCashflowRender, renderCashflowChart, redrawCharts, reason }) {
  try { renderKPI(); } catch (_) {}
  try {
    if (typeof ensureCashflowCurve === 'function') ensureCashflowCurve(reason);
    else if (typeof requestCashflowRender === 'function') requestCashflowRender(reason);
    else if (typeof renderCashflowChart === 'function') renderCashflowChart();
  } catch (_) {}
  try { if (typeof redrawCharts === 'function') redrawCharts(); } catch (_) {}
}

function bindKpiRangeControls({
  root,
  scope,
  scopeValue,
  displayDateISO,
  parseScope,
  resolveRange,
  constants,
  storage,
  renderKPI,
  ensureCashflowCurve,
  requestCashflowRender,
  renderCashflowChart,
  redrawCharts,
} = {}) {
  const host = root || document;
  const box = host.querySelector?.('#kpiRangeBox');
  const startEl = host.querySelector?.('#kpiRangeStart');
  const endEl = host.querySelector?.('#kpiRangeEnd');
  const applyEl = host.querySelector?.('#kpiRangeApply');
  if (!box || !startEl || !endEl) return false;

  const parsed = typeof parseScope === 'function' ? parseScope(scope) : { kind: 'range' };
  const range = typeof resolveRange === 'function' ? resolveRange(parsed, displayDateISO) : {};
  startEl.value = range.startISO || '';
  endEl.value = range.endISO || '';
  box.style.display = String(scopeValue || '') === 'range' ? 'flex' : 'none';

  if (box.dataset.bound) return true;
  box.dataset.bound = '1';
  const saveRange = (opts = {}) => {
    const start = String(startEl.value || '');
    const end = String(endEl.value || '');
    if (!start || !end) return;
    safeSetItem(storage, resolveScopeKey(constants), `range:${start}:${end}`);
    if (opts.apply) {
      refreshVisuals({
        renderKPI,
        ensureCashflowCurve,
        requestCashflowRender,
        renderCashflowChart,
        redrawCharts,
        reason: 'kpi-range-change',
      });
    }
  };

  box.addEventListener('pointerdown', (event) => { try { event.stopPropagation(); } catch (_) {} });
  box.addEventListener('mousedown', (event) => { try { event.stopPropagation(); } catch (_) {} });
  startEl.addEventListener('change', () => saveRange());
  endEl.addEventListener('change', () => saveRange());
  if (applyEl) applyEl.addEventListener('click', () => saveRange({ apply: true }));
  return true;
}

function bindKpiScopeSelector({
  root,
  scopeValue,
  constants,
  storage,
  renderKPI,
  ensureCashflowCurve,
  requestCashflowRender,
  renderCashflowChart,
  redrawCharts,
} = {}) {
  const host = root || document;
  const select = host.querySelector?.('#kpiScopeSelect');
  if (!select) return false;
  try { select.value = String(scopeValue || 'segment'); } catch (_) {}
  if (select.dataset.bound) return true;
  select.dataset.bound = '1';
  select.addEventListener('change', (event) => {
    const value = String(event?.target?.value || 'segment');
    const box = host.querySelector?.('#kpiRangeBox') || document.getElementById?.('kpiRangeBox');
    if (box) box.style.display = value === 'range' ? 'flex' : 'none';
    const key = resolveScopeKey(constants);
    if (value === 'range') {
      const start = String((host.querySelector?.('#kpiRangeStart') || document.getElementById?.('kpiRangeStart') || {}).value || '');
      const end = String((host.querySelector?.('#kpiRangeEnd') || document.getElementById?.('kpiRangeEnd') || {}).value || '');
      safeSetItem(storage, key, start && end ? `range:${start}:${end}` : 'range');
      return;
    }
    safeSetItem(storage, key, value);
    refreshVisuals({
      renderKPI,
      ensureCashflowCurve,
      requestCashflowRender,
      renderCashflowChart,
      redrawCharts,
      reason: 'kpi-scope-change',
    });
  });
  return true;
}

function bindKpiFxCalculator({
  root,
  state = {},
  base = 'EUR',
  constants,
  storage,
  rates = {},
  fxConvert,
  amountToEUR,
  eurToAmount,
  formatOutput = defaultFmtOut,
} = {}) {
  const host = root || document;
  const amountEl = host.querySelector?.('#kpiFxCalcAmount');
  const fromEl = host.querySelector?.('#kpiFxCalcFrom');
  const toEl = host.querySelector?.('#kpiFxCalcTo');
  const swapEl = host.querySelector?.('#kpiFxCalcSwap');
  const outputEl = host.querySelector?.('#kpiFxCalcOut');
  if (!amountEl || !fromEl || !toEl || !outputEl || amountEl.dataset.bound) return false;
  amountEl.dataset.bound = '1';

  const amountKey = constants?.LS_KEYS?.fx_calc_amount || 'travelbudget_fx_calc_amount_v1';
  const fromKey = constants?.LS_KEYS?.fx_calc_from || 'travelbudget_fx_calc_from_v1';
  const toKey = constants?.LS_KEYS?.fx_calc_to || 'travelbudget_fx_calc_to_v1';
  const currencies = new Set(['EUR']);
  try { Object.keys(rates || {}).forEach((key) => currencies.add(String(key || '').toUpperCase())); } catch (_) {}
  try { (state.wallets || []).forEach((wallet) => currencies.add(String(wallet?.currency || '').toUpperCase())); } catch (_) {}
  try { (state.budgetSegments || state.segments || []).forEach((segment) => currencies.add(String(segment?.baseCurrency || segment?.base_currency || '').toUpperCase())); } catch (_) {}
  currencies.add(String(state?.period?.baseCurrency || state?.period?.base_currency || '').toUpperCase());
  const list = Array.from(currencies).filter(Boolean).sort();
  const options = list.map((currency) => `<option value="${currency}">${currency}</option>`).join('');
  fromEl.innerHTML = options;
  toEl.innerHTML = options;

  const accountBase = String(
    state?.settings?.baseCurrency
      || state?.settings?.base_currency
      || state?.profile?.baseCurrency
      || state?.profile?.base_currency
      || state?.account?.baseCurrency
      || state?.account?.base_currency
      || base
      || 'EUR',
  ).toUpperCase();
  const periodBase = String(base || state?.period?.baseCurrency || state?.period?.base_currency || 'EUR').toUpperCase();
  const savedAmount = String(safeGetItem(storage, amountKey)).trim();
  const savedFrom = String(safeGetItem(storage, fromKey)).trim().toUpperCase();
  const savedTo = String(safeGetItem(storage, toKey)).trim().toUpperCase();
  amountEl.value = savedAmount || '';
  const fallbackCurrency = list.includes(accountBase) ? accountBase : (list.includes(periodBase) ? periodBase : list[0]);
  fromEl.value = list.includes(savedFrom) ? savedFrom : fallbackCurrency;
  toEl.value = list.includes(savedTo) ? savedTo : (list.includes(periodBase) ? periodBase : fallbackCurrency);

  const compute = () => {
    const amount = Number(amountEl.value);
    const from = String(fromEl.value || 'EUR');
    const to = String(toEl.value || 'EUR');
    if (!Number.isFinite(amount)) {
      outputEl.textContent = '-';
      return;
    }
    let out = null;
    try { if (typeof fxConvert === 'function') out = fxConvert(amount, from, to, rates); } catch (_) {}
    if (out === null || !Number.isFinite(out)) {
      try {
        if (to === 'EUR' && typeof amountToEUR === 'function') out = amountToEUR(amount, from);
        else if (from === 'EUR' && typeof eurToAmount === 'function') out = eurToAmount(amount, to);
      } catch (_) {}
    }
    outputEl.textContent = formatOutput(out, to);
    safeSetItem(storage, amountKey, String(amountEl.value || ''));
    safeSetItem(storage, fromKey, from);
    safeSetItem(storage, toKey, to);
  };

  [amountEl, fromEl, toEl].forEach((el) => el.addEventListener('input', compute));
  [amountEl, fromEl, toEl].forEach((el) => el.addEventListener('change', compute));
  if (swapEl && !swapEl.dataset.bound) {
    swapEl.dataset.bound = '1';
    swapEl.addEventListener('click', () => {
      const from = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = from;
      compute();
    });
  }
  compute();
  return true;
}

function bindKpiPendingToggle({
  root,
  constants,
  storage,
  requestRenderAll,
  renderKPI,
} = {}) {
  const host = root || document;
  const toggle = host.querySelector?.('#kpiIncludeUnpaidToggle') || document.getElementById?.('kpiIncludeUnpaidToggle');
  if (!toggle) return false;
  toggle.onchange = () => {
    const key = constants?.LS_KEYS?.kpi_projection_include_unpaid || 'travelbudget_kpi_projection_include_unpaid_v1';
    safeSetItem(storage, key, toggle.checked ? '1' : '0');
    if (typeof requestRenderAll === 'function') requestRenderAll('kpi:toggle');
    else if (typeof renderKPI === 'function') renderKPI();
  };
  return true;
}

function bindKpiInteractions(options = {}) {
  const root = options.root || document;
  const okRange = bindKpiRangeControls({ ...options, root });
  const okScope = bindKpiScopeSelector({ ...options, root });
  const periodSelect = root.querySelector?.('#kpiPeriodSelect');
  if (periodSelect) periodSelect.dataset.bound = '1';
  const okFx = bindKpiFxCalculator({ ...options, root });
  const okToggle = bindKpiPendingToggle({ ...options, root });
  return { range: okRange, scope: okScope, fx: okFx, toggle: okToggle };
}


window.TBKpiView = {
  ...(window.TBKpiView || {}),
  bindKpiRangeControls,
  bindKpiScopeSelector,
  bindKpiFxCalculator,
  bindKpiPendingToggle,
  bindKpiInteractions,
};
})();
