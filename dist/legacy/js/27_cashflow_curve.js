/* =========================
   Cashflow curve (réel + prévision) — ApexCharts
   - Réel: solde jour par jour (wallets + transactions payées, réparties sur dateStart/dateEnd)
   - Prévision: réel + (-budget/jour) + impayés (dépenses à payer / rentrées à recevoir) selon toggles
   - Dépensé/jour: barres sur les jours passés (expenses payées, affects_budget=true, hors out_of_budget & internal)
   - Seuils: 500€ et 0
   - Robustesse: jamais de NaN, message "pas de données" si besoin
   - Globals: window.renderCashflowChart, window.__cashflowChart
   ========================= */


/**
 * Alias container for regression checks:
 * - Keep existing engine container id="cashflowCurve" (used by JS)
 * - Ensure a stable wrapper id="cashflowChart" exists for diagnostics
 */
function ensureCashflowChartAlias() {
  try {
    const curveEl = document.getElementById("cashflowCurve");

    if (!curveEl) return;
    if (document.getElementById("cashflowChart")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "cashflowChart";

    // Preserve layout by inserting wrapper where curveEl currently sits
    const parent = curveEl.parentNode;
    if (!parent) return;

    parent.insertBefore(wrapper, curveEl);
    wrapper.appendChild(curveEl);
  } catch (_) {}
}

(function () {

  // --- local fallbacks (avoid hard dependency on other helpers) ---
  function _toISODate(d) {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    const y = x.getFullYear();
    const m = String(x.getMonth()+1).padStart(2,'0');
    const da = String(x.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  function _parseISODate(s) {
    if (!s) return null;
    const str = String(s).slice(0,10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function _addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function _forEachDateInclusive(start, end, fn) {
    let cur = new Date(start);
    const last = new Date(end);
    cur.setHours(0,0,0,0);
    last.setHours(0,0,0,0);
    while (cur <= last) {
      fn(new Date(cur));
      cur = _addDays(cur, 1);
    }
  }

  let chart = null;

  // UI state
  let includePendingExpenses = (localStorage.getItem("cashflow_include_pending_exp_v1") ?? "1") === "1";
  let includePendingIncomes  = (localStorage.getItem("cashflow_include_pending_inc_v1") ?? "1") === "1";

  // Segment filter (range + display currency for the chart)
  // - "current": current segment (today)
  // - "all": full period
  // - "seg:<i>": explicit segment index in state.budgetSegments
  // Curve scope follows KPI scope (single source of truth)

// Curve scope follows KPI scope (single source of truth)
const KPI_SCOPE_KEY = (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.kpi_projection_scope) || "travelbudget_kpi_projection_scope_v1";

function getKpiScope() {
  try {
    const raw = String(localStorage.getItem(KPI_SCOPE_KEY) || "segment");
    const low = raw.toLowerCase();
    const segs = getSegments();
    const todaySeg = getTodaySegment();

    if (low === "period") {
      return { mode: "period", start: String(state?.period?.start || "").slice(0,10), end: String(state?.period?.end || "").slice(0,10), segId: null, segBase: null };
    }

    if (raw.startsWith("seg:")) {
      const id = raw.slice(4);
      const seg = segs.find(s => String(s.id) === String(id));
      if (seg) {
        const ss = String(seg.start || seg.start_date || seg.startDate || "").slice(0,10);
        const ee = String(seg.end || seg.end_date || seg.endDate || "").slice(0,10);
        const bb = String(seg.baseCurrency || seg.base_currency || seg.base || "").toUpperCase();
        return { mode: "seg", start: ss, end: ee, segId: String(seg.id), segBase: bb };
      }
      // fallback
      if (todaySeg) return { mode: "segment", start: String(todaySeg.start || todaySeg.start_date || todaySeg.startDate || ""), end: String(todaySeg.end || todaySeg.end_date || todaySeg.endDate || ""), segId: String(todaySeg.id || ""), segBase: String(todaySeg.baseCurrency || todaySeg.base_currency || todaySeg.base || "") };
      return { mode: "period", start: String(state?.period?.start || ""), end: String(state?.period?.end || ""), segId: null, segBase: null };
    }

    if (raw.startsWith("range:")) {
      const parts = raw.split(":");
      const a = parts[1] || "";
      const b = parts[2] || "";
      if (a && b) return { mode: "range", start: String(a), end: String(b), segId: null, segBase: null };
      return { mode: "range", start: String(state?.period?.start || ""), end: String(state?.period?.end || ""), segId: null, segBase: null };
    }

    if (low === "range") {
      return { mode: "range", start: String(state?.period?.start || ""), end: String(state?.period?.end || ""), segId: null, segBase: null };
    }

    // Default: current segment (today)
    if (todaySeg) return { mode: "segment", start: String(todaySeg.start || todaySeg.start_date || todaySeg.startDate || ""), end: String(todaySeg.end || todaySeg.end_date || todaySeg.endDate || ""), segId: String(todaySeg.id || ""), segBase: String(todaySeg.baseCurrency || todaySeg.base_currency || todaySeg.base || "") };
    return { mode: "period", start: String(state?.period?.start || ""), end: String(state?.period?.end || ""), segId: null, segBase: null };
  } catch (_) {
    return { mode: "segment" };
  }
}
  function getSegments() {
    return Array.isArray(window.state?.budgetSegments) ? window.state.budgetSegments.filter(Boolean) : [];
  }

  function getTodaySegment() {
    if (typeof window.getBudgetSegmentForDate === "function") {
      return window.getBudgetSegmentForDate(todayStr());
    }
    return null;
  }

  function getSelectedSegment(scopeObj) {
    const s = scopeObj || getKpiScope();
    if (!s) return null;
    if (s.mode === "period" || s.mode === "range") return null;
    if (s.mode === "seg" && s.segId) {
      return getSegments().find(x => String(x.id) === String(s.segId)) || null;
    }
    return getTodaySegment();
  }

  function segLabel(seg) {
    if (!seg) return "";
    const s = String(seg.start || seg.start_date || seg.startDate || "").slice(0, 10);
    const e = String(seg.end || seg.end_date || seg.endDate || "").slice(0, 10);
    const c = String(seg.baseCurrency || seg.base_currency || seg.base || "").toUpperCase();
    const range = (s && e) ? `${s} → ${e}` : (s || e || "");
    return `${range}${c ? ` (${c})` : ""}`.trim();
  }

  // Category filter (same philosophy as expense pie chart)
  const CASHFLOW_CATS_KEY = "travelbudget_cashflow_excluded_categories_v1";
  let excludedCats = new Set();

  function loadExcludedCats() {
    try {
      const raw = localStorage.getItem(CASHFLOW_CATS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) excludedCats = new Set(arr.filter(Boolean).map(String));
    } catch (_) {}
  }

  function saveExcludedCats() {
    try { localStorage.setItem(CASHFLOW_CATS_KEY, JSON.stringify(Array.from(excludedCats))); } catch (_) {}
  }

  function getAllCategories() {
    const txs = (window.state && Array.isArray(window.state.transactions)) ? window.state.transactions : [];
    const set = new Set();
    txs.forEach((t) => {
      const c = (t && t.category) ? String(t.category) : "";
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // Defer render to avoid re-rendering while the click/change event is still bubbling.
  // Also handle rapid successive changes without requiring a second click.
  let _renderScheduled = false;
  let _renderInFlight = false;
  let _renderWanted = false;

  function _runQueuedRender() {
    _renderScheduled = false;
    if (_renderInFlight) {
      // Apex render/update still in progress; retry as soon as it yields.
      _renderScheduled = true;
      setTimeout(_runQueuedRender, 0);
      return;
    }
    _renderWanted = false;
    _renderInFlight = true;

    Promise.resolve()
      .then(() => new Promise((resolve) => setTimeout(resolve, 0))) // let DOM/localStorage settle
      .then(() => renderCashflowChart())
      .catch(() => {})
      .finally(() => {
        _renderInFlight = false;
        if (_renderWanted) queueRenderCashflow();
      });
  }

  function queueRenderCashflow() {
    _renderWanted = true;
    if (_renderScheduled) return;
    _renderScheduled = true;
    setTimeout(_runQueuedRender, 0);
  }

  function _segmentBaseForDate(dateStr) {
    try {
      const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(dateStr) : null;
      const cur = String(seg?.baseCurrency || seg?.base_currency || "").toUpperCase();
      return /^[A-Z]{3}$/.test(cur) ? cur : "";
    } catch (_) {
      return "";
    }
  }

  function _scopeHasMultipleSegmentCurrencies(scopeObj) {
    try {
      const s = scopeObj || getKpiScope();
      const startStr = String(s?.start || state?.period?.start || "").slice(0, 10);
      const endStr = String(s?.end || state?.period?.end || "").slice(0, 10);
      const start = window.parseISODateOrNull?.(startStr);
      const end = window.parseISODateOrNull?.(endStr);
      if (!start || !end) return false;
      const seen = new Set();
      (window.forEachDateInclusive ? window.forEachDateInclusive : _forEachDateInclusive)(start, end, (d) => {
        const ds = (window.toLocalISODate ? window.toLocalISODate(d) : _toISODate(d));
        const cur = _segmentBaseForDate(ds);
        if (cur) seen.add(cur);
      });
      return seen.size > 1;
    } catch (_) {
      return false;
    }
  }

  function _scopeSpansMultipleSegments(scopeObj) {
    try {
      const s = scopeObj || getKpiScope();
      const startStr = String(s?.start || state?.period?.start || "").slice(0, 10);
      const endStr = String(s?.end || state?.period?.end || "").slice(0, 10);
      const start = window.parseISODateOrNull?.(startStr);
      const end = window.parseISODateOrNull?.(endStr);
      if (!start || !end) return false;
      const seenSegs = new Set();
      const seenCurrencies = new Set();
      (window.forEachDateInclusive ? window.forEachDateInclusive : _forEachDateInclusive)(start, end, (d) => {
        const ds = (window.toLocalISODate ? window.toLocalISODate(d) : _toISODate(d));
        const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(ds) : null;
        const segId = String(seg?.id || "");
        const cur = String(seg?.baseCurrency || seg?.base_currency || "").toUpperCase();
        if (segId) seenSegs.add(segId);
        if (cur) seenCurrencies.add(cur);
      });
      return seenSegs.size > 1 || seenCurrencies.size > 1;
    } catch (_) {
      return false;
    }
  }

  function curveCurrency(scopeObj) {
    const scope = scopeObj || getKpiScope();
    if (_scopeSpansMultipleSegments(scope)) {
      const acct = accountBase();
      if (acct) return acct;
    }
    const selSeg = getSelectedSegment(scope);
    if (selSeg && (selSeg.baseCurrency || selSeg.base_currency)) {
      return String(selSeg.baseCurrency || selSeg.base_currency || "").toUpperCase();
    }
    const anchor = String(scope?.start || todayStr()).slice(0, 10);
    const segBase = _segmentBaseForDate(anchor);
    if (segBase) return segBase;
    return base(scope);
  }

  function base(scopeObj) {
    const scope = scopeObj || getKpiScope();
    const selSeg = getSelectedSegment(scope);
    if (selSeg && (selSeg.baseCurrency || selSeg.base_currency)) {
      return String(selSeg.baseCurrency || selSeg.base_currency || "").toUpperCase();
    }

    const multiSegCurrency = _scopeHasMultipleSegmentCurrencies(scope);
    if (multiSegCurrency) {
      const acct = accountBase();
      if (acct) return acct;
    }

    const anchor = String(scope?.start || todayStr()).slice(0, 10);
    const segBase = _segmentBaseForDate(anchor);
    if (segBase) return segBase;

    const d = todayStr();
    if (typeof window.getDisplayCurrency === "function") return String(window.getDisplayCurrency(d) || "").toUpperCase();
    return String(window.state?.period?.baseCurrency || "").toUpperCase();
  }

  function accountBase() {
    const uBase = String(window.state?.user?.baseCurrency || window.state?.user?.base_currency || "").toUpperCase();
    return (uBase && /^[A-Z]{3}$/.test(uBase)) ? uBase : "";
  }

  function todayStr() {
    return (window.toLocalISODate ? window.toLocalISODate(new Date()) : _toISODate(new Date()));
  }

  function round2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function toRenderForDate(amount, cur, dateStr, renderCurrency) {
    const target = String(renderCurrency || base() || '').toUpperCase();
    const a = safeNum(amount);
    const source = String(cur || target).toUpperCase();
    if (!target) return a;
    if (source === target) return a;

    try {
      const seg = (typeof window.getBudgetSegmentForDate === 'function') ? window.getBudgetSegmentForDate(dateStr) : null;
      if (seg && typeof window.fxConvert === 'function') {
        const rates = (typeof window.fxRatesForSegment === 'function')
          ? window.fxRatesForSegment(seg)
          : (typeof window.fxGetEurRates === 'function' ? window.fxGetEurRates() : {});
        const out = window.fxConvert(a, source, target, rates);
        if (out !== null && Number.isFinite(out)) return out;
      }
    } catch (_) {}

    if (typeof window.safeFxConvert === 'function') {
      const out = window.safeFxConvert(a, source, target, null);
      if (out !== null && Number.isFinite(out)) return out;
    }
    if (typeof window.fxConvert === 'function') {
      const out = window.fxConvert(a, source, target);
      if (out !== null && Number.isFinite(out)) return out;
    }
    return source === target ? a : 0;
  }

  function getDailyBudgetInRenderCurrency(dateStr, renderCurrency) {
    try {
      const info = (typeof window.getDailyBudgetInfoForDate === 'function')
        ? window.getDailyBudgetInfoForDate(dateStr)
        : null;
      const daily = safeNum(info?.daily ?? info?.dailyBudget ?? 0);
      const sourceCur = String(info?.baseCurrency || _segmentBaseForDate(dateStr) || renderCurrency || '').toUpperCase();
      return toRenderForDate(daily, sourceCur, dateStr, renderCurrency);
    } catch (_) {
      return 0;
    }
  }

  function budgetSpentForDateInRenderCurrency(dateStr, renderCurrency) {
    try {
      const txs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
      const target = String(dateStr || '');
      if (!target) return 0;
      let sum = 0;
      for (const t of txs) {
        if (!t || t.isInternal) continue;
        const type = String(t?.type || '').toLowerCase();
        if (type !== 'expense') continue;

        const cat = (t.category !== undefined && t.category !== null) ? String(t.category) : '';
        if (cat && excludedCats.has(cat)) continue;

        const affectsBudget = (t.affectsBudget === undefined || t.affectsBudget === null) ? true : !!t.affectsBudget;
        if (!affectsBudget) continue;
        const outOfBudget = !!t.outOfBudget || !!t.out_of_budget;
        if (outOfBudget) continue;

        const rng = txBudgetDateRange(t);
        if (!rng) continue;
        const sds = (window.toLocalISODate ? window.toLocalISODate(rng.start) : _toISODate(rng.start));
        const eds = (window.toLocalISODate ? window.toLocalISODate(rng.end) : _toISODate(rng.end));
        if (target < sds || target > eds) continue;

        const p = (t.payNow ?? t.pay_now);
        const isPaid = (p === undefined) ? true : !!p;

        const label = String(t.label || '');
        const isTrip = label.includes('[Trip]');
        const isTripAdvance = isTrip && label.includes('Avance');
        const affectsCashRaw = (t.affectsCash === undefined || t.affectsCash === null) ? null : !!t.affectsCash;
        const isTripUnpaidShare = isTrip && !isTripAdvance && type === 'expense';
        const affectsCash = (affectsCashRaw === null) ? (!isTripUnpaidShare) : affectsCashRaw;
        const isBudgetOnly = !isPaid && affectsBudget && !affectsCash;
        if (!isPaid && !isBudgetOnly) continue;

        const amt = safeNum(t.amount);
        if (!Number.isFinite(amt) || amt === 0) continue;
        const days = daysInclusive(rng.start, rng.end);
        if (!days) continue;
        const perDay = amt / days;
        sum += toRenderForDate(perDay, t.currency || renderCurrency, target, renderCurrency);
      }
      return sum;
    } catch (_) {
      return 0;
    }
  }

  function toBase(amount, cur, scopeObj) {
    const b = base(scopeObj);
    const a = safeNum(amount);
    const c = String(cur || b).toUpperCase();

    if (!b) return a;

    // If a specific segment is selected, convert using that segment's FX overrides
    // without relying on the global display-currency mechanism.
    const selSeg = getSelectedSegment(scopeObj);
    if (selSeg && typeof window.fxConvert === "function") {
      const rates = (typeof window.fxRatesForSegment === "function")
        ? window.fxRatesForSegment(selSeg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const v = window.fxConvert(a, c, b, rates);
      return (v === null || !Number.isFinite(v)) ? 0 : v;
    }

    if (typeof window.amountToDisplayForDate === "function") {
      const v = window.amountToDisplayForDate(a, c, todayStr());
      return Number.isFinite(v) ? v : 0;
    }
    if (typeof window.amountToBase === "function") {
      const v = window.amountToBase(a, c);
      return Number.isFinite(v) ? v : 0;
    }
    if (typeof window.safeFxConvert === "function") {
      return window.safeFxConvert(a, c, b, 0);
    }
    if (typeof window.fxConvert === "function") {
      const v = window.fxConvert(a, c, b);
      return (v === null || !Number.isFinite(v)) ? 0 : v;
    }
    return (c === b) ? a : 0;
  }

  function sumWalletsBase(scopeObj) {
    const b = base(scopeObj);
    if (!b) return 0;
    let total = 0;
    for (const w of (window.state?.wallets || [])) {
      const eff = (typeof window.tbGetWalletEffectiveBalance === "function")
        ? (window.tbGetWalletEffectiveBalance(w?.id) || 0)
        : (w?.balance || 0);
      total += toBase(eff || 0, w?.currency || b, scopeObj);
    }
    return round2(total);
  }

  function sumWalletsInCurrency(scopeObj, renderCurrency) {
    const target = String(renderCurrency || curveCurrency(scopeObj) || base(scopeObj) || "").toUpperCase();
    if (!target) return 0;
    let total = 0;
    for (const w of (window.state?.wallets || [])) {
      const eff = (typeof window.tbGetWalletEffectiveBalance === "function")
        ? (window.tbGetWalletEffectiveBalance(w?.id) || 0)
        : (w?.balance || 0);
      total += toRenderForDate(eff || 0, w?.currency || target, todayStr(), target);
    }
    return round2(total);
  }

    function txCashDateRange(tx) {
    // Cash / treasury timeline:
    // - primary source = date_start/date_end
    // - legacy fallback = date / at / created_at
    const ds = tx?.dateStart || tx?.date_start || tx?.date || tx?.at || tx?.created_at;
    const de = tx?.dateEnd || tx?.date_end || tx?.date || tx?.at || tx?.created_at || ds;

    const parse = (window.parseISODateOrNull ? window.parseISODateOrNull : _parseISODate);
    const s = parse(ds);
    const e = parse(de);

    if (!s) return null;
    return { start: s, end: e || s };
  }

  function txBudgetDateRange(tx) {
    // Budget / analysis timeline:
    // - primary source = budget_date_start / budget_date_end
    // - controlled fallback = cash range only when budget dates are absent
    const ds = tx?.budgetDateStart || tx?.budget_date_start || tx?.dateStart || tx?.date_start || tx?.date || tx?.at || tx?.created_at;
    const de = tx?.budgetDateEnd || tx?.budget_date_end || tx?.dateEnd || tx?.date_end || ds;

    const parse = (window.parseISODateOrNull ? window.parseISODateOrNull : _parseISODate);
    const s = parse(ds);
    const e = parse(de);

    if (!s) return null;
    return { start: s, end: e || s };
  }

  function daysInclusive(d1, d2) {
    // assumes Date objects at midnight
    const ms = 24 * 3600 * 1000;
    const n = Math.round((d2.getTime() - d1.getTime()) / ms);
    return Math.max(0, n) + 1;
  }

  function addDistributed(map, start, end, delta) {
    const n = daysInclusive(start, end);
    if (!n) return;
    const perDay = delta / n;

    (window.forEachDateInclusive ? window.forEachDateInclusive : _forEachDateInclusive)(start, end, (d) => {
      const k = (window.toLocalISODate ? window.toLocalISODate(d) : _toISODate(d));
      map[k] = (map[k] || 0) + perDay;
    });
  }

  function buildMaps(transactions, startDate, endDate) {
  const paidSpentAll = {};
  const paidSpentBudget = {};
  const pendingNetExp = {};
  const pendingNetInc = {};

  function add(map, date, value) {
    if (!date) return;
    map[date] = (map[date] || 0) + value;
  }

  function distribute(map, start, end, value) {
    if (!start) return;

    const s = start;
    const e = end || start;

    const days = eachDayOfInterval({ start: new Date(s), end: new Date(e) });
    const perDay = value / days.length;

    for (const d of days) {
      const key = format(d, 'yyyy-MM-dd');
      add(map, key, perDay);
    }
  }

  for (const t of transactions) {
    const isExpense = t.type === 'expense';
    const isIncome = t.type === 'income';

    const amount = Number(t.amount || 0);

    const cashRange = txCashDateRange(t);
    const budgetRange = txBudgetDateRange(t);

    const isPaid = t.pay_now === true;
    const affectsBudget = t.affects_budget !== false;
    const outOfBudget = t.out_of_budget === true;

    // =========================
    // CASH timeline (réel)
    // =========================
    if (isPaid) {
      if (isExpense) {
        distribute(paidSpentAll, cashRange.start, cashRange.end, amount);
      } else if (isIncome) {
        distribute(paidSpentAll, cashRange.start, cashRange.end, -amount);
      }
    } else {
      if (isExpense) {
        distribute(pendingNetExp, cashRange.start, cashRange.end, amount);
      } else if (isIncome) {
        distribute(pendingNetInc, cashRange.start, cashRange.end, amount);
      }
    }

    // =========================
    // BUDGET timeline (budget)
    // =========================
    if (affectsBudget && !outOfBudget) {
      if (isExpense) {
        distribute(paidSpentBudget, budgetRange.start, budgetRange.end, amount);
      } else if (isIncome) {
        distribute(paidSpentBudget, budgetRange.start, budgetRange.end, -amount);
      }
    }
  }

  return {
    paidSpentAll,
    paidSpentBudget,
    pendingNetExp,
    pendingNetInc,
  };
}

  function walletEventDateStr(tx) {
    const raw = tx?.dateStart || tx?.date_start || tx?.date || tx?.at || tx?.created_at;
    const parse = (window.parseISODateOrNull ? window.parseISODateOrNull : _parseISODate);
    const d = parse(raw);
    if (!d) return "";
    return (window.toLocalISODate ? window.toLocalISODate(d) : _toISODate(d));
  }

  function txWalletEffectAmount(tx, targetCurrency, dateStr) {
    const amt = safeNum(tx?.amount || 0);
    if (!Number.isFinite(amt) || amt === 0) return 0;
    const type = String(tx?.type || "").toLowerCase();
    if (type !== "expense" && type !== "income") return 0;
    const converted = toRenderForDate(amt, tx?.currency || targetCurrency, dateStr || todayStr(), targetCurrency);
    if (!Number.isFinite(converted) || converted === 0) return 0;
    return type === "income" ? converted : -converted;
  }

  function buildPaidWalletEffectMap(periodStart, periodEnd, renderCurrency) {
    const out = {};
    const target = String(renderCurrency || curveCurrency() || "").toUpperCase();
    const txs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    for (const t of txs) {
      if (!t) continue;
      const walletId = String(t?.walletId ?? t?.wallet_id ?? "");
      if (!walletId) continue;
      const p = (t.payNow ?? t.pay_now);
      const isPaid = (p === undefined) ? true : !!p;
      if (!isPaid) continue;
      if (!!(t.isInternal ?? t.is_internal)) continue;
      const ds = walletEventDateStr(t);
      if (!ds) continue;
      const d = (window.parseISODateOrNull ? window.parseISODateOrNull : _parseISODate)(ds);
      if (!d) continue;
      if (d < periodStart || d > periodEnd) continue;
      const signed = txWalletEffectAmount(t, target, ds);
      if (!Number.isFinite(signed) || signed === 0) continue;
      out[ds] = safeNum(out[ds]) + signed;
    }
    return out;
  }
    function sumPaidWalletEffectsBetween(fromDateStr, toDateStr, renderCurrency) {
    const parse = (window.parseISODateOrNull ? window.parseISODateOrNull : _parseISODate);
    const from = parse(fromDateStr);
    const to = parse(toDateStr);
    const target = String(renderCurrency || curveCurrency() || base() || "").toUpperCase();

    if (!from || !to || !target || to < from) return 0;

    const txs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    let total = 0;

    for (const tx of txs) {
      if (!tx) continue;
      if (tx.isInternal || tx.is_internal) continue;

      const walletId = tx.wallet_id || tx.walletId || tx.wallet?.id || null;
      if (!walletId) continue;

      const p = (tx.payNow ?? tx.pay_now);
      const isPaid = (p === undefined) ? true : !!p;
      if (!isPaid) continue;

      const dStr = walletEventDateStr(tx);
      if (!dStr) continue;

      const d = parse(dStr);
      if (!d || d < from || d > to) continue;

      total += txWalletEffectAmount(tx, target, dStr);
    }

    return round2(total);
  }
  // =========================
  // Cache (V6.6) - avoids heavy recompute on reload
  // =========================
  function _cashflowCacheKey() {
    try {
      const rev = Number(window.__TB_DATA_REV || 0);
      const scope = (typeof getKpiScope === "function" ? getKpiScope() : {});
      const seg = (scope && (scope.segId || scope.seg_id)) || "";
      const start = (scope && scope.start) || "";
      const end = (scope && scope.end) || "";
      const baseCur = String((state && state.user && (state.user.baseCurrency || state.user.base_currency)) || (scope && (scope.segBase || scope.seg_base)) || (state && state.period && (state.period.baseCurrency || state.period.base_currency)) || "").toUpperCase();
      return `tb_cashflow_cache_v1|${rev}|${seg}|${start}|${end}|${baseCur}`;
    } catch (_) {
      return "tb_cashflow_cache_v1|0";
    }
  }
  function _cashflowCacheGet() {
    try {
      const k = _cashflowCacheKey();
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;
      return obj;
    } catch (_) { return null; }
  }
  function _cashflowCacheSet(obj) {
    try {
      const k = _cashflowCacheKey();
      localStorage.setItem(k, JSON.stringify(obj));
    } catch (_) {}
  }
function buildSeries() {
    const period = window.state?.period;
    if (!period?.start || !period?.end) return { ok:false, reason:"Aucune période définie." };

    // Date range depends on the selected segment filter.
    // Note: we keep all computations in the chart "base" currency (selected segment currency or display currency).
    const scope = getKpiScope();
    const selSeg = getSelectedSegment(scope);
    const rangeStartStr = (scope && scope.start) ? String(scope.start).slice(0, 10) : String(period.start).slice(0, 10);
    const rangeEndStr   = (scope && scope.end)   ? String(scope.end).slice(0, 10)   : String(period.end).slice(0, 10);

    const start = window.parseISODateOrNull?.(rangeStartStr);
    const end = window.parseISODateOrNull?.(rangeEndStr);
    if (!start || !end) return { ok:false, reason:"Dates de période invalides." };

    const lineCurrency = curveCurrency(scope);
    const barCurrency = base(scope);
    if (!lineCurrency || !barCurrency) return { ok:false, reason:"Devise de base manquante." };

    const tStr = todayStr();
    const tDate = window.parseISODateOrNull?.(tStr);

    const rangeHasMultiSegmentCurrency = _scopeHasMultipleSegmentCurrencies(scope);
    const dailyBudgetLabel = rangeHasMultiSegmentCurrency ? null : safeNum(getDailyBudgetInRenderCurrency(tStr, lineCurrency));

    const currentBalance = sumWalletsInCurrency(scope, lineCurrency);

    const lineMaps = buildMaps(start, end, lineCurrency);
    const barMaps = (lineCurrency === barCurrency) ? lineMaps : buildMaps(start, end, barCurrency);
    const { pendingNetExp, pendingNetInc } = lineMaps;
    const { paidSpentAll, paidSpentBudget } = barMaps;
    const paidWalletNet = buildPaidWalletEffectMap(start, end, lineCurrency);

    const startStr = (window.toLocalISODate ? window.toLocalISODate(start) : _toISODate(start));
    const anchorEndStr = tDate
      ? (window.toLocalISODate ? window.toLocalISODate(tDate) : _toISODate(tDate))
      : todayStr();

    const rollbackSinceStart = sumPaidWalletEffectsBetween(startStr, anchorEndStr, lineCurrency);
    const startBalance = round2(currentBalance - rollbackSinceStart);

    const actual = [];
    const forecast = [];
    const spentBars = [];
    const budgetUsedVal = [];

    let bal = startBalance;

    (window.forEachDateInclusive ? window.forEachDateInclusive : _forEachDateInclusive)(start, end, (d) => {
      const k = (window.toLocalISODate ? window.toLocalISODate(d) : _toISODate(d));

      const used = safeNum(budgetSpentForDateInRenderCurrency(k, barCurrency) || paidSpentBudget[k] || 0);

      if (tDate && d <= tDate) {
        bal += safeNum(paidWalletNet[k] || 0);
        actual.push({ x: k, y: round2(bal) });
        forecast.push({ x: k, y: (tDate && d.getTime() === tDate.getTime()) ? round2(bal) : null });

        const spent = safeNum(paidSpentAll[k] || 0);
        spentBars.push({ x: k, y: round2(spent) });
        budgetUsedVal.push({ x: k, y: round2(used) });
      } else {
        // forecast starts from last actual balance
        bal -= getDailyBudgetInRenderCurrency(k, lineCurrency);

        if (includePendingExpenses) bal += safeNum(pendingNetExp[k] || 0);
        if (includePendingIncomes)  bal += safeNum(pendingNetInc[k] || 0);

        actual.push({ x: k, y: null });
        forecast.push({ x: k, y: round2(bal) });
        spentBars.push({ x: k, y: null });
        budgetUsedVal.push({ x: k, y: round2(used) });
      }
    });

    // thresholds
    // - Stored as EUR reference (so when account base currency changes, the displayed base threshold changes automatically)
    // - The curve y-axis stays in period currency `b`.
    // - We plot the threshold line converted into `b`, but label it in account base currency.
    let thrEur = 500;
    try {
      const THR_KEY = (window.TB_CONST?.LS_KEYS?.cashflow_threshold_eur || "travelbudget_cashflow_threshold_eur_v1");
      const raw = localStorage.getItem(THR_KEY);
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) thrEur = n;
    } catch (_) {}

    const uBase = accountBase();

    // 1) Convert EUR ref -> account base (for label)
    const thrBase = (uBase && typeof window.safeFxConvert === "function")
      ? window.safeFxConvert(thrEur, "EUR", uBase, null)
      : (uBase && typeof window.fxConvert === "function" ? window.fxConvert(thrEur, "EUR", uBase) : null);
    const thrBaseVal = (thrBase === null || !Number.isFinite(thrBase)) ? null : round2(thrBase);

    // 2) Convert account base -> curve currency (for the plotted line)
    const thrLine = (thrBaseVal !== null && typeof window.safeFxConvert === "function")
      ? window.safeFxConvert(thrBaseVal, uBase || "EUR", lineCurrency, null)
      : (thrBaseVal !== null && typeof window.fxConvert === "function" ? window.fxConvert(thrBaseVal, uBase || "EUR", lineCurrency) : null);
    const thr500 = (thrLine === null || !Number.isFinite(thrLine)) ? null : round2(thrLine);

    // validate: no NaN in series
    const allY = []
      .concat(actual.map(p => p.y), forecast.map(p => p.y), spentBars.map(p => p.y), budgetUsedVal.map(p => p.y))
      .filter(v => v !== null);
    if (allY.some(v => Number.isNaN(v))) return { ok:false, reason:"Séries invalides (NaN)." };

    const thrLabel = (thrBaseVal !== null && uBase) ? `${thrBaseVal} ${uBase}` : null;
    return { ok:true, b: lineCurrency, lineCurrency, barCurrency, start, end, tStr, dailyBudget: dailyBudgetLabel, currentBalance, startBalance, actual, forecast, spentBars, budgetUsedVal, thr500, thrLabel, segFilter: getKpiScope(), segLabel: selSeg ? segLabel(selSeg) : "Période complète" };
  }

  async function renderCashflowChart() {
    // keep in sync with existing navigation
    if (typeof window.activeView !== "undefined" && window.activeView !== "dashboard") return;
// Dedup guard: avoid double render on first load / refresh if called twice rapidly with same scope
try {
  const __k = _cashflowCacheKey();
  const __now = Date.now();
  if (renderCashflowChart.__lastKey === __k && (__now - (renderCashflowChart.__lastTs || 0)) < 1200) {
    return;
  }
  renderCashflowChart.__lastKey = __k;
  renderCashflowChart.__lastTs = __now;
} catch (_) {}

    // Load category filter from localStorage (idempotent)
    if (!renderCashflowChart.__catsLoaded) {
      loadExcludedCats();
      renderCashflowChart.__catsLoaded = true;
    }

    const container = document.getElementById("solde-projection-container");
    if (!container) return;

    if (typeof ApexCharts !== "function") {
      container.innerHTML = '<div class="card"><h2>Solde</h2><div class="muted">ApexCharts non chargé.</div></div>';
      return;
    }

    let built = null;
    try {
      if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("cashflow:render");
      const __cached = _cashflowCacheGet();
      if (__cached && __cached.ok && __cached.series && __cached.options) {
        built = __cached;
      } else {
        built = buildSeries();
        if (built && built.ok) _cashflowCacheSet(built);
      }
    } catch (err) {
      window.__cashflowChart = null;
      container.innerHTML = `
        <div class="card">
          <h2>Solde</h2>
          <div class="muted" style="margin-top:6px;">Erreur cashflow: ${escapeHTML(err && err.message ? err.message : String(err))}</div>
        </div>`;
      return;
    }

    if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("cashflow:render");

    if (!built.ok) {
      container.innerHTML = `
        <div class="card">
          <h2>Solde</h2>
          <div class="muted" style="margin-top:6px;">Pas de données : ${escapeHTML(built.reason || "—")}</div>
        </div>`;
      return;
    }

    // Categories UI (filters only the daily columns)
    const allCats = getAllCategories();
    const includedCatsCount = allCats.filter((c) => !excludedCats.has(c)).length;
    const catsDetails = allCats.length
      ? `
          <details class="cashflow-cats" style="margin-left:6px;">
            <summary style="cursor:pointer; user-select:none;">Catégories (${includedCatsCount}/${allCats.length})</summary>
            <div style="margin-top:8px; max-height:180px; overflow:auto; border:1px solid rgba(0,0,0,.12); border-radius:12px; padding:10px; background:#fff; min-width:220px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                <button type="button" class="btn" id="cashflowCatsAll" style="padding:4px 8px;">Tout</button>
                <button type="button" class="btn" id="cashflowCatsNone" style="padding:4px 8px;">Aucun</button>
              </div>
              ${allCats
                .map((c) => {
                  const checked = !excludedCats.has(c);
                  return `
                    <label style="display:flex; align-items:center; gap:8px; padding:4px 0;">
                      <input type="checkbox" class="cashflowCatCb" data-cat="${encodeURIComponent(c)}" ${checked ? "checked" : ""}/>
                      <span>${escapeHTML(c)}</span>
                    </label>`;
                })
                .join("")}
            </div>
          </details>`
      : "";

    // Segment filter UI (range)
    const segs = getSegments();
    const __sc = getKpiScope();
    const scopeLabel = (__sc && __sc.mode === "period") ? "Toute la période"
      : (__sc && __sc.mode === "range") ? "Date à date"
      : (__sc && __sc.mode === "seg") ? "Période sélectionnée"
      : "Segment courant";

    // UI
    container.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap;">
          <div>
            <h2>Solde</h2>
            <div class="muted" style="margin-top:4px;">
              Projection basée sur ton budget journalier.
            </div>
          </div>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <span class="muted" data-cf-scope style="padding:6px 8px;border:1px solid rgba(0,0,0,0.10);border-radius:10px; font-size:12px;">Scope: ${scopeLabel}</span>
                        <label class="muted" style="display:flex; gap:6px; align-items:center;">
              <input type="checkbox" id="cf-pending-exp" ${includePendingExpenses ? "checked" : ""}/>
              Dépenses à payer
            </label>
            <label class="muted" style="display:flex; gap:6px; align-items:center;">
              <input type="checkbox" id="cf-pending-inc" ${includePendingIncomes ? "checked" : ""}/>
              Rentrées à recevoir
            </label>
            ${catsDetails}
            <button class="btn" id="cf-reset-zoom">Reset zoom</button>
          </div>
        </div>

        <div id="cashflowCurve" style="margin-top:12px;"></div>

        <div class="muted" style="margin-top:10px; display:flex; gap:12px; flex-wrap:wrap;">
          <span>Plage: <b>${escapeHTML(built.segLabel || "—")}</b></span>
          <span>Devise courbe: <b>${built.lineCurrency}</b></span>
          <span>Devise colonnes: <b>${built.barCurrency}</b></span>
          <span>Budget/jour: <b>${built.dailyBudget === null ? 'Variable selon période' : (round2(built.dailyBudget) + ' ' + built.lineCurrency)}</b></span>
          <span>Solde actuel (wallets): <b>${round2(built.currentBalance)} ${built.lineCurrency}</b></span>
        </div>
      </div>
    `;

    const series = [
      { name: `Solde réel (${built.lineCurrency})`, data: built.actual, type: "line" },
      { name: `Prévision (${built.lineCurrency})`, data: built.forecast, type: "line" },
      { name: `Dépensé/jour (${built.barCurrency})`, data: built.spentBars, type: "column" },
      { name: `Budget dépensé/jour (${built.barCurrency})`, data: built.budgetUsedVal, type: "column" }
    ];

    
    // ---- Axis ranges (keep cash lines on same scale, bars on same scale) ----
    const _extractY = (p) => {
      if (p === null || p === undefined) return null;
      if (typeof p === "number") return p;
      if (typeof p === "object") {
        if ("y" in p) return p.y;
        if (Array.isArray(p) && p.length > 1) return p[1];
      }
      return null;
    };
    const _minMaxFor = (pred) => {
      let min = Infinity, max = -Infinity;
      series.forEach((s) => {
        if (!pred(s)) return;
        (s.data || []).forEach((p) => {
          const y = Number(_extractY(p));
          if (!Number.isFinite(y)) return;
          if (y < min) min = y;
          if (y > max) max = y;
        });
      });
      if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: undefined, max: undefined };
      if (min === max) {
        // give Apex some breathing room
        const pad = Math.max(1, Math.abs(min) * 0.05);
        return { min: min - pad, max: max + pad };
      }
      const pad = (max - min) * 0.05;
      return { min: min - pad, max: max + pad };
    };

    const cashRange = _minMaxFor((s) => s.type !== "column"); // real + forecast + thresholds
    const barsRange = _minMaxFor((s) => s.type === "column"); // daily bars
const yaxis = (() => {
      // 2 axes visibles: gauche = trésorerie (lines), droite = barres quotidiennes (columns)
      let rightShown = false;
      return series.map((s, i) => {
        const isBar = s.type === "column";
        const showAxis = (!isBar && i === 0) || (isBar && !rightShown);
        if (isBar && !rightShown) rightShown = true;

        return {
          opposite: isBar,
          show: showAxis,
          min: isBar ? barsRange.min : cashRange.min,
          max: isBar ? barsRange.max : cashRange.max,
          labels: {
            show: showAxis,
            formatter: (v) => {
              if (v === null || v === undefined) return "—";
              const n = Number(v);
              if (!Number.isFinite(n)) return "—";
              return Math.round(n).toLocaleString();
            }
          }
        };
      });
    })();

    const options = {
      chart: {
        type: "line",
        height: 320,
        toolbar: { show: true },
        zoom: { enabled: true }
      },
      series,
      xaxis: {
        type: "datetime",
        labels: { datetimeUTC: false }
      },
      yaxis,
      stroke: {
        width: series.map(s => (s.type === "column" ? 0 : 3)),
        curve: "smooth"
      },
      markers: { size: 0, hover: { sizeOffset: 3 } },
fill: { opacity: series.map(s => (s.type === "column" ? 0.85 : 1)) },
plotOptions: { bar: { columnWidth: "45%", borderRadius: 2 } },
legend: { position: "bottom", horizontalAlign: "center" },
dataLabels: { enabled: false },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v, opts) => {
            if (v === null || v === undefined) return "—";
            const sName = opts && opts.w && opts.w.config && opts.w.config.series && opts.w.config.series[opts.seriesIndex]
              ? String(opts.w.config.series[opts.seriesIndex].name || "")
              : "";
            const cur = (opts && opts.w && opts.w.config && opts.w.config.series && opts.w.config.series[opts.seriesIndex] && opts.w.config.series[opts.seriesIndex].type === 'column') ? built.barCurrency : built.lineCurrency;
            return `${round2(v)} ${cur}`;
          }
        }
      },
      grid: {
        borderColor: window.cssVar?.("--gridline", "rgba(0,0,0,0.1)") || "rgba(0,0,0,0.1)"
      },
      annotations: {
        xaxis: built.tStr ? [{
          x: built.tStr,
          borderColor: window.cssVar?.("--warn", "#f59e0b") || "#f59e0b",
          label: { text: "Aujourd’hui", style: { background: window.cssVar?.("--warn", "#f59e0b") || "#f59e0b" } }
        }] : [],
        yaxis: (built.thr500 !== null ? [
          {
            y: 0,
            borderColor: window.cssVar?.("--muted", "#94a3b8") || "#94a3b8",
            label: { text: "0", style: { background: window.cssVar?.("--muted", "#94a3b8") || "#94a3b8" } }
          },
	          {
	            y: built.thr500,
	            borderColor: "#ef4444",
	            strokeDashArray: 6,
	            label: { text: (built.thrLabel || `${built.thr500} ${String(built.lineCurrency || "").toUpperCase()}`), style: { background: "#ef4444" } }
	          }
        ] : [
          {
            y: 0,
            borderColor: window.cssVar?.("--muted", "#94a3b8") || "#94a3b8",
            label: { text: "0", style: { background: window.cssVar?.("--muted", "#94a3b8") || "#94a3b8" } }
          }
        ])
      },

      theme: { mode: document.body.classList.contains("theme-dark") ? "dark" : "light" }
    };

    const el = document.querySelector("#cashflowCurve");
    if (!el) return;

    try { if (chart) chart.destroy(); } catch (_) {}
    chart = new ApexCharts(el, options);
    await chart.render();
    window.__cashflowChart = chart; // debug contract

    const btn = document.getElementById("cf-reset-zoom");
    if (btn) btn.onclick = () => { try { chart.resetZoom(); } catch (_) {} };
    const cbExp = document.getElementById("cf-pending-exp");
    if (cbExp) cbExp.onchange = (e) => {
      includePendingExpenses = !!e.target.checked;
      try { localStorage.setItem("cashflow_include_pending_exp_v1", includePendingExpenses ? "1" : "0"); } catch (_) {}
      queueRenderCashflow();
    };

    const cbInc = document.getElementById("cf-pending-inc");
    if (cbInc) cbInc.onchange = (e) => {
      includePendingIncomes = !!e.target.checked;
      try { localStorage.setItem("cashflow_include_pending_inc_v1", includePendingIncomes ? "1" : "0"); } catch (_) {}
      queueRenderCashflow();
    };

    // Category filter UI
    const catCbs = container.querySelectorAll(".cashflowCatCb");
    catCbs.forEach((cb) => {
      cb.onchange = () => {
        let cat = cb.getAttribute("data-cat") || "";
        try { cat = decodeURIComponent(cat); } catch (_) {}
        if (!cat) return;
        if (cb.checked) excludedCats.delete(cat);
        else excludedCats.add(cat);
        saveExcludedCats();
        queueRenderCashflow();
      };
    });

    const btnAll = document.getElementById("cashflowCatsAll");
    const btnNone = document.getElementById("cashflowCatsNone");
    if (btnAll) btnAll.onclick = () => {
      excludedCats.clear();
      saveExcludedCats();
      queueRenderCashflow();
    };
    if (btnNone) btnNone.onclick = () => {
      getAllCategories().forEach((c) => excludedCats.add(c));
      saveExcludedCats();
      queueRenderCashflow();
    };
  }

  // expose for checks
  window.renderCashflowChart = renderCashflowChart;

  

  // Hooks: redrawCharts / refreshAll / dataUpdated bus
  function hook(name) {
    const fn = window[name];
    if (typeof fn !== "function") return false;
    if (fn.__cashflowHooked) return;
    const wrapped = async function (...args) {
      const out = await fn.apply(this, args);
      try { queueRenderCashflow(); } catch (_) {}
      return out;
    };
    wrapped.__cashflowHooked = true;
    window[name] = wrapped;
    return true;
  }

  function _runCashflowInit() {
    try { hookRedrawCharts(); } catch (e) {}
    try { hookRefreshAll(); } catch (e) {}
    // Re-render when data/state is refreshed.
    // The app event bus emits both typed events (tb:*) and the legacy 'data:updated'.
    try {
      document.addEventListener("data:updated", queueRenderCashflow);
      document.addEventListener("tb:fx:updated", queueRenderCashflow);
    } catch (_) {}
    // Fallback render only if no regular dashboard render has happened yet.
    setTimeout(() => {
      try {
        if (!window.__cashflowChart && (typeof window.activeView === "undefined" || window.activeView === "dashboard")) {
          queueRenderCashflow();
        }
      } catch (_) {}
    }, 300);
  }

  // IMPORTANT: legacy scripts are injected dynamically by /src/main.js.
  // If we register DOMContentLoaded after it already fired, it will never run.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _runCashflowInit);
  } else {
    _runCashflowInit();
  }
})();

// =========================
// Cashflow Curve render scheduler (coalesce + dedup)
// =========================
(function () {
  const KEY = "__TB_CASHFLOW_CURVE_SCHED";
  if (window[KEY]) return;

  let scheduled = false;
  let lastKey = "";

  function _scopeKey() {
    const rev = String(window.__TB_DATA_REV || 0);
    const seg = String(window.__TB_ACTIVE_SEGMENT_ID || "");
    const start = String(window.__TB_ACTIVE_START || "");
    const end = String(window.__TB_ACTIVE_END || "");
    return rev + "|" + seg + "|" + start + "|" + end;
  }

  window.tbRequestCashflowCurveRender = function tbRequestCashflowCurveRender(reason) {
    if (window.__TB_BOOTING) {
      window.__TB_BOOT_NEEDS_CASHFLOW_CURVE = true;
      return;
    }

    const k = _scopeKey();
    if (k === lastKey) return;
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      const k2 = _scopeKey();
      if (k2 === lastKey) return;
      lastKey = k2;

      try {
        try {
          if (window.__tbDebugRender) console.log("[TB] cashflow:render", { reason: reason || "unknown", key: k2 });
        } catch (_) {}
        if (typeof renderCashflowCurve === "function") renderCashflowCurve();
      } catch (e) {
        console.error("CashflowCurve render failed:", e);
      }
    });
  };

  window[KEY] = true;
})();