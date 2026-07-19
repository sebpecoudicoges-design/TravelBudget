/* =========================
   KPI + Render (micro animation)
   ========================= */

function budgetClass(v) {
  if (v >= state.period.dailyBudgetBase * 0.7) return "good";
  if (v >= state.period.dailyBudgetBase * 0.35) return "warn";
  return "bad";
}

function _activeTravelIdKpi() {
  try { return String(window.state?.activeTravelId || state?.activeTravelId || ""); } catch (_) { return ""; }
}

function _txMatchesActiveTravelKpi(tx) {
  return window.TBKpiHealthRules?.txMatchesActiveTravel?.(tx, _activeTravelIdKpi()) ?? true;
}

function _txAffectsBudgetKpi(tx) {
  try { if (typeof window.tbTxAffectsBudget === 'function') return !!window.tbTxAffectsBudget(tx); } catch (_) {}
  return window.TBKpiHealthRules?.txAffectsBudget?.(tx) ?? false;
}

function _txAffectsCashKpi(tx) {
  try { if (typeof window.tbTxAffectsCash === 'function') return !!window.tbTxAffectsCash(tx); } catch (_) {}
  return window.TBKpiHealthRules?.txAffectsCash?.(tx) ?? true;
}

function _kpiNormText(s) {
  return window.TBKpiHealthRules?.normText?.(s) ?? String(s || "").toLowerCase().trim();
}

function _kpiNutritionFoods() {
  try {
    if (Array.isArray(window.state?.nutritionFoods)) return window.state.nutritionFoods;
    const key = window.TB_CONST?.LS_KEYS?.nutrition_food_cache || "travelbudget_nutrition_food_cache_v1";
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function _kpiFoodForNutritionItem(item) {
  const key = String(item?.food_key || item?.foodKey || "");
  return _kpiNutritionFoods().find((food) => String(food?.key || "") === key) || { key, name: item?.label || key, tags: [] };
}

function _kpiAlcoholForFood(food, grams) {
  try {
    if (window.Core?.nutritionRules?.alcoholForGrams) return window.Core.nutritionRules.alcoholForGrams(food, grams);
  } catch (_) {}
  return window.TBKpiHealthRules?.alcoholForFood?.(food, grams) || { gramsAlcohol: 0, standardDrinks: 0 };
}

function _kpiIsInternalMovementTx(tx) {
  try {
    if (typeof window.tbIsInternalMovement === "function" && window.tbIsInternalMovement(tx)) return true;
  } catch (_) {}
  return window.TBKpiHealthRules?.isInternalMovementTx?.(tx) ?? false;
}

function _kpiIsTripLinkedTx(tx) {
  return window.TBKpiHealthRules?.isTripLinkedTx?.(tx) ?? false;
}

function _kpiIsCashPendingProjectionTx(tx) {
  return window.TBKpiHealthRules?.isCashPendingProjectionTx?.(tx, { activeTravelId: _activeTravelIdKpi() }) ?? false;
}

function _kpiActivitySummaryForDate(dateISO) {
  const day = String(dateISO || '').slice(0, 10);
  const activityKcal = (typeof window.tbActivityKcalForDay === "function")
    ? window.tbActivityKcalForDay(day)
    : null;
  return window.TBKpiHealthRules?.activitySummaryForDate?.(day, { state: window.state || state || {}, activityKcal })
    || { sportCount: 0, sportKcal: 0, workCount: 0, workKcal: 0, workMinutes: 0 };
}

function _kpiBodyMetric(key, fallback) {
  try {
    const ls = window.TB_CONST?.LS_KEYS || {};
    const map = {
      weight: ls.sport_body_weight || "travelbudget_sport_body_weight_v1",
      height: ls.sport_body_height || "travelbudget_sport_body_height_v1",
      birthdate: ls.body_birthdate || "travelbudget_body_birthdate_v1",
      age: ls.body_age || "travelbudget_body_age_v1",
      sex: ls.body_sex || "travelbudget_body_sex_v1",
      bmr: ls.body_bmr || "travelbudget_body_bmr_v1",
    };
    const raw = (key === "weight" || key === "height")
      ? (window.tbReadScopedLocalStorage ? window.tbReadScopedLocalStorage(map[key], fallback) : localStorage.getItem(map[key]))
      : localStorage.getItem(map[key]);
    return raw === null || raw === "" ? fallback : raw;
  } catch (_) {
    return fallback;
  }
}

function _kpiAgeFromBirthDate(value) {
  if (window.Core?.bodyEnergyRules?.ageFromBirthDate) return window.Core.bodyEnergyRules.ageFromBirthDate(value);
  return window.TBKpiHealthRules?.ageFromBirthDate?.(value, new Date()) ?? 0;
}

function _kpiBaselineKcal() {
  return window.TBKpiHealthRules?.baselineKcal?.({ readBodyMetric: _kpiBodyMetric, now: new Date() }) ?? 1200;
}

function _kpiNutritionGoal() {
  try {
    if (typeof window.tbLoadHealthGoal === "function") return window.tbLoadHealthGoal();
    const key = `${window.TB_CONST?.LS_KEYS?.health_goal || "travelbudget_health_goal_v1"}::${window.sbUser?.id || "anon"}`;
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    const modeRaw = String(raw.mode || "bulk");
    return {
      mode: ["bulk", "maintenance", "cut"].includes(modeRaw) ? modeRaw : "maintenance",
      surplusKcal: Math.max(300, Math.min(500, Math.round(Number(raw.surplusKcal) || 350))),
      deficitKcal: Math.max(250, Math.min(500, Math.round(Number(raw.deficitKcal) || 300))),
    };
  } catch (_) {
    return { mode: "bulk", surplusKcal: 350, deficitKcal: 300 };
  }
}

function _kpiNutritionSummaryForDate(dateISO) {
  return window.TBKpiHealthRules?.nutritionSummaryForDate?.(dateISO, {
    state: window.state || state || {},
    foods: _kpiNutritionFoods(),
    alcoholForGrams: window.Core?.nutritionRules?.alcoholForGrams || null,
  }) || { mealCount: 0, itemCount: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, drinkWaterMl: 0, foodWaterMl: 0, alcoholDrinks: 0, alcoholGrams: 0, alcoholEntries: [] };
}

function _kpiSleepSummaryForDate(dateISO) {
  const readRows = () => {
    try {
      if (window.state?.nutritionSleep && typeof window.state.nutritionSleep === "object") return window.state.nutritionSleep;
      const lsKey = window.TB_CONST?.LS_KEYS?.nutrition_sleep || "travelbudget_nutrition_sleep_v1";
      const scoped = `${lsKey}::${window.sbUser?.id || "anon"}`;
      return JSON.parse(localStorage.getItem(scoped) || "{}") || {};
    } catch (_) {
      return {};
    }
  };
  return window.TBKpiHealthRules?.sleepSummaryForDate?.(dateISO, {
    rows: readRows(),
    todayISO: typeof window.toLocalISODate === "function" ? window.toLocalISODate(new Date()) : new Date().toISOString().slice(0, 10),
  }) || { hours: 0, quality: "ok", nightDay: "" };
}

function _kpiOffsetDateISO(day, offsetDays) {
  return window.TBKpiHealthRules?.offsetDateISO?.(day, offsetDays, typeof window.toLocalISODate === "function" ? window.toLocalISODate(new Date()) : new Date().toISOString().slice(0, 10))
    || String(day || "").slice(0, 10);
}

function _kpiAlcoholWeekSummaryForDate(dateISO) {
  const rows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = _kpiOffsetDateISO(dateISO, -i);
    const nutrition = _kpiNutritionSummaryForDate(day);
    rows.push({ day, drinks: Number(nutrition.alcoholDrinks) || 0 });
  }
  return {
    rows,
    drinks: rows.reduce((sum, row) => sum + row.drinks, 0),
    drinkingDays: rows.filter((row) => row.drinks > 0.05).length,
  };
}

function _kpiHealthSummaryForDate(dateISO, activity) {
  return window.TBKpiHealthRules?.healthSummaryForDate?.(dateISO, {
    activity,
    state: window.state || state || {},
    foods: _kpiNutritionFoods(),
    sleepRows: _kpiSleepSummaryForDate(dateISO) ? (() => {
      try {
        if (window.state?.nutritionSleep && typeof window.state.nutritionSleep === "object") return window.state.nutritionSleep;
        const lsKey = window.TB_CONST?.LS_KEYS?.nutrition_sleep || "travelbudget_nutrition_sleep_v1";
        return JSON.parse(localStorage.getItem(`${lsKey}::${window.sbUser?.id || "anon"}`) || "{}") || {};
      } catch (_) { return {}; }
    })() : {},
    readBodyMetric: _kpiBodyMetric,
    nutritionGoal: _kpiNutritionGoal(),
    todayISO: typeof window.toLocalISODate === "function" ? window.toLocalISODate(new Date()) : new Date().toISOString().slice(0, 10),
    now: new Date(),
    alcoholForGrams: window.Core?.nutritionRules?.alcoholForGrams || null,
  }) || { score: 0, level: "bad", label: "A corriger", advice: "Module KPI sante indisponible." };
}

function _kpiHealthActionRows(h) {
  return window.TBKpiHealthRules?.healthActionRows?.(h) || [];
}


try {
  window.tbComputeHealthSummaryForDate = function tbComputeHealthSummaryForDate(dateISO, activity) {
    return _kpiHealthSummaryForDate(dateISO, activity || _kpiActivitySummaryForDate(dateISO));
  };
} catch (_) {}
function remainingBudgetBaseFrom(dateStr) {
  const start = parseISODateOrNull(dateStr);
  const end = parseISODateOrNull(state.period.end);
  if (!start || !end) return 0;

  let sum = 0;
  forEachDateInclusive(start, end, (d) => {
    const ds = toLocalISODate(d);
    const b = getDailyBudgetForDate(ds);
    sum += Math.max(0, b);
  });
  return sum;
}

function projectedEndEUR() {
  const today = toLocalISODate(new Date());
  const remainingBase = remainingBudgetBaseFrom(today);
  const remainingEUR = amountToEUR(remainingBase, state.period.baseCurrency);
  return totalInEUR() - remainingEUR;
}

function netPendingEUR(rangeStartISO, rangeEndISO) {
  // Net of unpaid items (pay_now=false) within an optional date range:
  // + unpaid incomes, - unpaid expenses
  // Excludes internal/shadow rows (isInternal=true)
  //
  // A tx is included if its [dateStart,dateEnd] overlaps [rangeStartISO,rangeEndISO].
  // If no range is provided, includes all unpaid tx in the active period.
  const rs = rangeStartISO ? parseISODateOrNull(rangeStartISO) : null;
  const re = rangeEndISO ? parseISODateOrNull(rangeEndISO) : null;

  function _txOverlaps(tx) {
    if (!rs && !re) return true;
    const ds = parseISODateOrNull(tx.dateStart) || (tx.date ? new Date(Number(tx.date)) : null);
    const de = parseISODateOrNull(tx.dateEnd) || ds;
    if (!ds) return false;

    const a = clampMidnight(ds);
    const b = clampMidnight(de || ds);

    const r0 = rs ? clampMidnight(rs) : null;
    const r1 = re ? clampMidnight(re) : null;

    if (r0 && b < r0) return false;
    if (r1 && a > r1) return false;
    return true;
  }

  let net = 0;
  for (const tx of (state.transactions || [])) {
    if (!_kpiIsCashPendingProjectionTx(tx)) continue;
    if (!_txOverlaps(tx)) continue;

    const v = amountToEUR(Number(tx.amount) || 0, tx.currency);
    if (tx.type === "income") net += v;
    else if (tx.type === "expense") net -= v;
  }
  return net;
}

function _kpiDatesOverlap(aStartISO, aEndISO, bStartISO, bEndISO) {
  return window.TBKpiProjectionRules?.datesOverlap?.(aStartISO, aEndISO, bStartISO, bEndISO) ?? true;
}

function _kpiTripNetRowInRange(row, rangeStartISO, rangeEndISO) {
  return window.TBKpiProjectionRules?.tripNetRowInRange?.(row, rangeStartISO, rangeEndISO, Array.isArray(state?.periods) ? state.periods : []) ?? true;
}

function fmtKPICompact(v) {
  return window.TBKpiProjectionRules?.fmtKpiCompact?.(v) ?? String(Math.round(Number(v) || 0));
}

function projectedEndDisplayWithOptions(opts) {
  // KPI "Fin période":
  //   trésorerie actuelle (wallets) - prévision quotidienne (budget/jour) jusqu'à la fin
  //   + optionnel: inclure les entrées/dépenses non payées/reçues (toggle)
  // Par défaut, l'horizon = segment courant. opts.scope='period' => horizon = fin de période.

  const includeUnpaid = !!opts?.includeUnpaid;
const scopeRaw = String(opts?.scope || "segment");
const scope = scopeRaw.toLowerCase();
const todayISO = (typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : toLocalISODate(new Date());

  function _eurRateForDate(cur, dateISO) {
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return 1;

    // Period base currency: prefer period eurBaseRate (1 EUR = X BASE)
    const periodBase = String(state?.period?.baseCurrency || "").toUpperCase();
    const periodRate = Number(state?.period?.eurBaseRate);
    if (periodBase && c === periodBase && Number.isFinite(periodRate) && periodRate > 0) return periodRate;

    // Segment override (fixed)
    if (typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(dateISO);
      const segCur = String(seg?.baseCurrency || "").toUpperCase();
      const segMode = String(seg?.fxMode || "").toLowerCase();
      const segRate = Number(seg?.eurBaseRateFixed);
      if (segCur && c === segCur && segMode === "fixed" && Number.isFinite(segRate) && segRate > 0) return segRate;
    }

    // Live FX cache
    if (typeof window.fxGetEurRates === "function") {
      const rates = window.fxGetEurRates() || {};
      const r = Number(rates[c]);
      if (Number.isFinite(r) && r > 0) return r;
    }

    return null;
  }

  function _toEURSafe(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return a;
    const r = _eurRateForDate(c, dateISO);
    if (!(Number.isFinite(r) && r > 0)) {
      try {
        window.__kpiFxMiss = window.__kpiFxMiss || {};
        const k = c + "->EUR";
        window.__kpiFxMiss[k] = (window.__kpiFxMiss[k] || 0) + 1;
      } catch (_) {}
      return 0;
    }
    // 1 EUR = r CUR => CUR -> EUR = / r
    return a / r;
  }
  function _tripNetBalancesEUR(dateISO, rangeStartISO, rangeEndISO) {
    const rows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
      ? state.tripNetBalances
      : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
    const byTrip = new Map();
    for (const row of rows) {
      const net = Number(row?.net || 0);
      if (!Number.isFinite(net) || Math.abs(net) < 0.000001) continue;
      if (!_kpiTripNetRowInRange(row, rangeStartISO, rangeEndISO)) continue;
      const cur = String(row?.currency || state?.period?.baseCurrency || "EUR").toUpperCase();
      let converted = null;
      if (cur === "EUR") {
        converted = net;
      } else {
        try {
          if (typeof window.fxConvert === "function") converted = window.fxConvert(net, cur, "EUR");
        } catch (_) {}
      }
      if (converted === null || !Number.isFinite(converted)) continue;
      const key = String(row?.tripId || row?.trip_id || row?.tripName || row?.trip_name || "trip");
      byTrip.set(key, (byTrip.get(key) || 0) + converted);
    }
    let out = 0;
    for (const v of byTrip.values()) {
      if (Math.abs(Number(v) || 0) >= 1) out += v;
    }
    return out;
  }

  // Total wallets now in EUR
  let totalNowEUR = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
  ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
  : (Number(w.balance) || 0);
    const cur = w.currency || "EUR";
    totalNowEUR += _toEURSafe(bal, cur, todayISO);
  }

  // Pending (unpaid/unreceived) in EUR
const horizonStartISO = String(opts?.rangeStartISO || todayISO);

// Horizon end (default: provided range end; else resolve from scope)
let horizonEndISO = String(opts?.rangeEndISO || (state?.period?.end || todayISO));
try {
  if (!opts?.rangeEndISO) {
    if (scope === "period") {
      horizonEndISO = String(state?.period?.end || todayISO);
    } else if (scopeRaw.startsWith("seg:")) {
      const segId = scopeRaw.slice(4);
      const seg = (state.budgetSegments || []).find(s => String(s.id) === String(segId));
      if (seg && (seg.end || seg.end_date)) horizonEndISO = String(seg.end || seg.end_date);
    } else if (scopeRaw.startsWith("range:")) {
      const parts = scopeRaw.split(":");
      if (parts[2]) horizonEndISO = String(parts[2]);
    } else if (typeof getBudgetSegmentForDate === "function") {
      const seg0 = getBudgetSegmentForDate(todayISO);
      if (seg0 && (seg0.end || seg0.end_date)) horizonEndISO = String(seg0.end || seg0.end_date);
    }
  }
} catch (_) {}

  const pendingEUR = includeUnpaid
    ? ((Number(netPendingEUR(horizonStartISO, horizonEndISO)) || 0) + _tripNetBalancesEUR(todayISO, horizonStartISO, horizonEndISO))
    : 0;

  // Forecast daily budget (sum of daily budgets) in EUR
  let forecastEUR = 0;
  const start = parseISODateOrNull(todayISO);
  const end = parseISODateOrNull(horizonEndISO);
  if (start && end) {
    forEachDateInclusive(start, end, (d) => {
      const ds = toLocalISODate(d);
      let cur = String(state?.period?.baseCurrency || "EUR").toUpperCase();
      let daily = Number(state?.period?.dailyBudgetBase || 0);
      try {
        if (ds === todayISO && typeof getDailyBudgetInfoForDate === "function") {
          const info = getDailyBudgetInfoForDate(ds);
          const infoCur = String(info?.baseCurrency || '').toUpperCase();
          const remaining = Number(info?.remaining);
          if (infoCur) cur = infoCur;
          if (Number.isFinite(remaining)) daily = Math.max(0, remaining);
        } else if (typeof getBudgetSegmentForDate === "function") {
          const seg = getBudgetSegmentForDate(ds);
          if (seg) {
            const segCur = String(seg?.baseCurrency || seg?.base_currency || "").toUpperCase();
            const segDaily = Number(seg?.dailyBudgetBase ?? seg?.daily_budget_base);
            if (segCur) cur = segCur;
            if (Number.isFinite(segDaily)) daily = segDaily;
          }
        }
      } catch (_) {}

      forecastEUR += _toEURSafe(Math.max(0, daily), cur, ds);
    });
  }

  return (totalNowEUR + pendingEUR) - forecastEUR;
}


function _toBaseForDate(amount, cur, dateISO) {
  const a = Number(amount) || 0;
  const from = String(cur || "EUR").toUpperCase();
  const base = String(state?.period?.baseCurrency || "EUR").toUpperCase();
  if (from === base) return a;

  const rFrom = _eurRateForDate(from, dateISO);
  const rBase = _eurRateForDate(base, dateISO);

  // If we can't convert reliably, return 0 (better than exploding projections).
  if (!(rFrom && rBase)) {
    // Optional debug hook (throttled)
    try {
      window.__kpiFxMiss = window.__kpiFxMiss || {};
      const k = from + "->" + base;
      window.__kpiFxMiss[k] = (window.__kpiFxMiss[k] || 0) + 1;
    } catch (_) {}
    return 0;
  }

  // EUR pivot: amount(from) / (EUR->from) = EUR, then * (EUR->base)
  return (a / rFrom) * rBase;
}


// NOTE: orphaned projection snippet removed (was causing Illegal return statement at top-level).



/* =========================
   CASH helpers
   ========================= */

// Cash wallets definition:
// - Prefer explicit wallet.type === 'cash' (Option 2)
// - Fallback: name contains "cash" (legacy)
function _getCashWallets() {
  return window.TBKpiCashRules?.getCashWallets?.(state.wallets || [])
    || (state.wallets || []).filter(w => String(w?.type || "").toLowerCase() === "cash");
}

// Amount convertible to BASE with current engine:
// - BASE currency itself
// - EUR (via EUR-BASE)
// Otherwise: not convertible (FX missing)
function _toBaseSafe(amount, currency) {
  const base = (typeof window.getDisplayCurrency === 'function') ? window.getDisplayCurrency(window.getDisplayDateISO()) : state?.period?.baseCurrency;
  return window.TBKpiCashRules?.toBaseSafe?.(amount, currency, {
    baseCurrency: base,
    exchangeRates: state.exchangeRates || {},
    fxConvert: (typeof window.fxConvert === "function") ? window.fxConvert : null,
  }) || { ok: false, v: 0 };
}


function _sumCashWalletsBase() {
  const base = (typeof window.getDisplayCurrency === 'function') ? window.getDisplayCurrency(window.getDisplayDateISO()) : state?.period?.baseCurrency;
  return window.TBKpiCashRules?.sumCashWalletsBase?.(state.wallets || [], {
    baseCurrency: base,
    exchangeRates: state.exchangeRates || {},
    fxConvert: (typeof window.fxConvert === "function") ? window.fxConvert : null,
    effectiveBalance: (typeof window.tbGetWalletEffectiveBalance === "function")
      ? (wallet) => window.tbGetWalletEffectiveBalance(wallet.id)
      : null,
  }) || { totalBase: 0, excluded: [] };
}

/* =========================
   Cash runway (UX): based on real cash expenses
   ========================= */
function cashRunwayInfo(windowDays = 7) {
  const base = state.period.baseCurrency;
  return window.TBKpiCashRules?.cashRunwayInfo?.({
    wallets: state.wallets || [],
    transactions: state.transactions || [],
    period: state.period || {},
    baseCurrency: base,
    exchangeRates: state.exchangeRates || {},
    fxConvert: (typeof window.fxConvert === "function") ? window.fxConvert : null,
    effectiveBalance: (typeof window.tbGetWalletEffectiveBalance === "function") ? (wallet) => window.tbGetWalletEffectiveBalance(wallet.id) : null,
    activeTravelId: _activeTravelIdKpi(),
    txMatchesActiveTravel: _txMatchesActiveTravelKpi,
    txAffectsCash: _txAffectsCashKpi,
    isInternalMovement: (tx) => {
      try { return (typeof window.tbIsInternalMovement === 'function') ? window.tbIsInternalMovement(tx) : _kpiIsInternalMovementTx(tx); }
      catch (_) { return _kpiIsInternalMovementTx(tx); }
    },
    txCashDate: (tx) => (typeof tbTxCashDate === 'function') ? tbTxCashDate(tx) : tx.dateStart,
    windowDays,
    now: new Date(),
  }) || null;
}

/* =========================
   Cash conservative cover (UX): based on allocations/budget usage
   ========================= */
function cashConservativeInfo() {
  const base = state.period.baseCurrency;
  return window.TBKpiCashRules?.cashConservativeInfo?.({
    wallets: state.wallets || [],
    period: state.period || {},
    baseCurrency: base,
    exchangeRates: state.exchangeRates || {},
    fxConvert: (typeof window.fxConvert === "function") ? window.fxConvert : null,
    effectiveBalance: (typeof window.tbGetWalletEffectiveBalance === "function") ? (wallet) => window.tbGetWalletEffectiveBalance(wallet.id) : null,
    periodContains: (typeof periodContains === "function") ? periodContains : (() => true),
    getDailyBudgetForDate: (typeof getDailyBudgetForDate === "function") ? getDailyBudgetForDate : (() => 0),
    now: new Date(),
  }) || null;
}

function _daysPill(daysLeft, labelPrefix) {
  return window.TBKpiProjectionRules?.daysPill?.(daysLeft, labelPrefix)
    || { level: "good", text: `${labelPrefix}: ∞` };
}

function _renderTodayDetailsHTML(dateStr) {
  const info = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(dateStr)
    : { baseCurrency: state?.period?.baseCurrency };
  const fallbackBase = String(info?.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();
  const details = Array.isArray(info?.rows) ? info.rows : [];
  return window.TBKpiView?.renderKpiTodayDetails?.({
    rows: details,
    fallbackBase,
    emptyLabel: "Aucun détail",
  }) || "";
}

function _sumWalletsDisplay(dateStr) {
  const base = (typeof window.getDisplayCurrency === "function") ? window.getDisplayCurrency(dateStr) : (state?.period?.baseCurrency || "EUR");
  let total = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);
    const cur = w.currency || base;
    if (typeof window.amountToDisplayForDate === "function") {
      total += window.amountToDisplayForDate(bal, cur, dateStr);
    } else {
      total += amountToBase(bal, cur);
    }
  }
  return total;
}


function _addDaysISO(dateStr, days) {
  const d = parseISODateOrNull(dateStr);
  if (!d) return dateStr;
  const x = new Date(d);
  x.setDate(x.getDate() + (Number(days) || 0));
  return toLocalISODate(x);
}

function _pilotageInsights(scopeMeta) {
  const today = toLocalISODate(new Date());
  const kind = String(scopeMeta?.kind || "segment");
  const startISO = String(scopeMeta?.startISO || "").slice(0,10);
  const endISO = String(scopeMeta?.endISO || "").slice(0,10);

  // Pilotage should align with the user's projection toggle.
  // If enabled, we include pending amounts (to pay / to receive) in the balance.
  const includePending = (localStorage.getItem("travelbudget_kpi_projection_include_unpaid_v1") === "1");

  // Anchor day for calculations:
  // - default: today
  // - if scope starts in the future, anchor = scope start
  // - if scope ended in the past, nothing useful to show
  let anchorISO = today;
  const tD = parseISODateOrNull(today);
  const sD = parseISODateOrNull(startISO);
  const eD = parseISODateOrNull(endISO);
  if (!tD || !eD) return null;
  if (sD && clampMidnight(sD) > clampMidnight(tD)) anchorISO = startISO;
  const aD = parseISODateOrNull(anchorISO);
  if (!aD) return null;
  if (clampMidnight(aD) > clampMidnight(eD)) return null;

  const info = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(anchorISO)
    : { remaining: getDailyBudgetForDate(anchorISO), daily: state?.period?.dailyBudgetBase || 0, baseCurrency: state?.period?.baseCurrency || "EUR" };

  const base = String(info.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();
  if (!base) return null;

  // Remaining horizon (inclusive)
  const daysRemaining = Math.max(1, dayCountInclusive(clampMidnight(aD), clampMidnight(eD)));

  // --- FX helpers (pilotage must be stable even when the scope spans multiple segments/currencies)
  function _pilotRatesForDate(dateISO) {
    try {
      if (typeof getBudgetSegmentForDate === "function" && typeof fxRatesForSegment === "function") {
        const seg = getBudgetSegmentForDate(dateISO);
        return fxRatesForSegment(seg);
      }
    } catch (_) {}
    return (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
  }

  function _toEUR(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return a;
    try {
      if (typeof window.fxConvert === "function") {
        const rates = _pilotRatesForDate(dateISO || today);
        const out = window.fxConvert(a, c, "EUR", rates);
        if (out !== null && isFinite(out)) return out;
      }
    } catch (_) {}
    if (typeof amountToEUR === "function") return amountToEUR(a, c);
    return a;
  }

  function _fromEUR(amountEUR, toCur, dateISO) {
    const a = Number(amountEUR) || 0;
    const c = String(toCur || "EUR").toUpperCase();
    if (c === "EUR") return a;
    try {
      if (typeof window.fxConvert === "function") {
        const rates = _pilotRatesForDate(dateISO || today);
        const out = window.fxConvert(a, "EUR", c, rates);
        if (out !== null && isFinite(out)) return out;
      }
    } catch (_) {}
    // fallback legacy: if only EUR<->BASE is supported, this may be approximate.
    if (typeof eurToAmount === "function") return eurToAmount(a, c);
    return a;
  }

  // Balance in EUR (pivot), optionally including pending.
  let walletTotalEUR = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);
    const cur = String(w.currency || "EUR").toUpperCase();
    walletTotalEUR += _toEUR(bal, cur, anchorISO);
  }

  let pendingEUR = 0;
  try {
    if (includePending && typeof netPendingEUR === "function") {
      pendingEUR = Number(netPendingEUR(anchorISO, endISO)) || 0;
    }
    if (includePending) {
      const rows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
        ? state.tripNetBalances
        : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
      const byTrip = new Map();
      for (const row of rows) {
        const net = Number(row?.net || 0);
        if (!_kpiTripNetRowInRange(row, anchorISO, endISO)) continue;
        if (Number.isFinite(net) && Math.abs(net) > 0.000001) {
          const cur = String(row?.currency || state?.period?.baseCurrency || "EUR").toUpperCase();
          let converted = null;
          try {
            if (typeof window.fxConvert === "function") {
              converted = window.fxConvert(net, cur, "EUR");
              if (converted === null || !Number.isFinite(converted)) converted = window.fxConvert(net, cur, "EUR", _pilotRatesForDate(anchorISO));
            }
          } catch (_) {}
          if (converted !== null && Number.isFinite(converted)) {
            const key = String(row?.tripId || row?.trip_id || row?.tripName || row?.trip_name || "trip");
            byTrip.set(key, (byTrip.get(key) || 0) + converted);
          }
        }
      }
      for (const v of byTrip.values()) {
        if (Math.abs(Number(v) || 0) >= 1) pendingEUR += v;
      }
    }
  } catch (_) {}

  const balanceEUR = walletTotalEUR + pendingEUR;
  const balanceBase = _fromEUR(balanceEUR, base, anchorISO);

  // Planned spend over the horizon (uses the daily budgets of each segment, converted to EUR).
  let plannedSpendEUR = 0;
  try {
    const segs = Array.isArray(state?.budgetSegments) ? state.budgetSegments.slice() : [];
    segs.sort((a,b) => String(a.start||a.start_date||"").localeCompare(String(b.start||b.start_date||"")));
    const a0 = clampMidnight(aD);
    const e0 = clampMidnight(eD);
    for (const seg of segs) {
      const ss = String(seg.start || seg.start_date || "").slice(0,10);
      const ee = String(seg.end || seg.end_date || "").slice(0,10);
      const sDt = parseISODateOrNull(ss);
      const eDt = parseISODateOrNull(ee);
      if (!sDt || !eDt) continue;
      const sM = clampMidnight(sDt);
      const eM = clampMidnight(eDt);
      // overlap with [anchor, end]
      const lo = (sM > a0) ? sM : a0;
      const hi = (eM < e0) ? eM : e0;
      if (lo > hi) continue;
      const days = Math.max(1, dayCountInclusive(lo, hi));
      const segBase = String(seg.baseCurrency || seg.base_currency || base).toUpperCase();
      const segDaily = Number(seg.dailyBudgetBase || seg.daily_budget_base || seg.daily || seg.daily_budget || 0) || 0;
      const dailyEUR = _toEUR(segDaily, segBase, ss || anchorISO);
      plannedSpendEUR += dailyEUR * days;
    }
  } catch (_) {}

  // If we couldn't compute from segments (unexpected state), fallback to current daily * days.
  const fallbackDaily = Number(info.daily || 0);
  if (!(plannedSpendEUR > 0)) {
    plannedSpendEUR = _toEUR(fallbackDaily, base, anchorISO) * daysRemaining;
  }

  const avgPlannedDailyEUR = plannedSpendEUR / daysRemaining;
  const currentDaily = _fromEUR(avgPlannedDailyEUR, base, anchorISO);

  // Cible: finir à 0 (on pourra rendre paramétrable plus tard)
  const targetEnd = 0;

  // Recommended daily (average) to reach target at end of horizon.
  const recommendedDaily = (balanceBase - targetEnd) / daysRemaining;

  // Si tu gardes ton budget actuel, où tu finis ?
  // Projected end balance if we follow the planned daily budgets across segments.
  const projectedEndEUR = balanceEUR - plannedSpendEUR;
  const projectedEndBalance = _fromEUR(projectedEndEUR, base, anchorISO);

  // Jusqu’à quand tu tiens avec le budget actuel (date estimée)
  const daysAtCurrent = (currentDaily > 0) ? Math.floor(balanceBase / currentDaily) : Infinity;
  const zeroDate = isFinite(daysAtCurrent)
    ? _addDaysISO(anchorISO, Math.max(0, daysAtCurrent))
    : "—";

  // Décision courte
  let decision = "Aligné";
  let decisionLevel = "good";

  if (currentDaily <= 0) {
    decision = "Budget/j invalide";
    decisionLevel = "warn";
  } else {
    const ratio = recommendedDaily / currentDaily;
    if (ratio < 0.95) {
      decision = "Réduire";
      decisionLevel = "warn";
      if (ratio < 0.75) decisionLevel = "bad";
    } else if (ratio > 1.05) {
      decision = "Augmenter";
      decisionLevel = "good";
    } else {
      decision = "Aligné";
      decisionLevel = "good";
    }
  }

  return {
    kind,
    base,
    today: anchorISO,
    end: endISO,
    start: startISO,
    daysRemaining,
    balanceBase,
    currentDaily,
    recommendedDaily,
    projectedEndBalance,
    zeroDate,
    decision,
    decisionLevel,
  };
}

function _signPillClass(v) {
  return window.TBKpiProjectionRules?.signPillClass?.(v, state?.period?.dailyBudgetBase || 1) || "good";
}

/* =========================
   KPI render
   ========================= */
function renderKPI() {
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("kpi:render"); } catch (_) {}
  const __out = (function(){

  const kpi = document.getElementById("kpi");
  const T = window.tbT || ((k) => k);

  // ✅ GUARD: si la vue n'a pas encore monté le conteneur KPI, on ne fait rien.
  if (!kpi) return;

  const today = toLocalISODate(new Date());
  // Display date can later be driven by UI (state.uiDateISO). If absent, it defaults to today.
  const displayDateISO = (typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : today;
  try {
    const hasActivity = window.state?.activityDataLoaded === true
      && Array.isArray(window.state?.sportSessions)
      && Array.isArray(window.state?.workDays);
    if (!hasActivity && !window.__TB_KPI_ACTIVITY_LOADING__ && typeof window.tbEnsureActivityData === "function") {
      window.__TB_KPI_ACTIVITY_LOADING__ = true;
      window.tbEnsureActivityData({ reason: "kpi" })
        .then((result) => {
          window.__TB_KPI_ACTIVITY_LOADING__ = false;
          if (result?.loaded && typeof renderKPI === "function") renderKPI();
        })
        .catch(() => { window.__TB_KPI_ACTIVITY_LOADING__ = false; });
    }
  } catch (_) {}
  const infoToday = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(displayDateISO)
    : { remaining: getDailyBudgetForDate(displayDateISO), daily: state.period.dailyBudgetBase, baseCurrency: state.period.baseCurrency };
  const base = String(infoToday.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();

  // FX KPI: 1€ expressed in current base currency (of display date segment)
  let fxRateText = "—";
  try {
    const rates = (typeof fxRatesForSegment === "function" && typeof getBudgetSegmentForDate === "function")
      ? fxRatesForSegment(getBudgetSegmentForDate(displayDateISO))
      : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
    if (base === "EUR") {
      fxRateText = "1€ = 1.00 EUR";
    } else if (typeof window.fxConvert === "function") {
      const v = window.fxConvert(1, "EUR", base, rates);
      if (v !== null && isFinite(v)) fxRateText = `1€ = ${Number(v).toFixed(3)} ${base}`;
    }
  } catch (_) {}


  const budgetToday = Number(infoToday.remaining) || getDailyBudgetForDate(displayDateISO);
  const includeUnpaid = (localStorage.getItem("travelbudget_kpi_projection_include_unpaid_v1") === "1");
  const kpiScope = (localStorage.getItem("travelbudget_kpi_projection_scope_v1") || "segment");
  const displayCur = base;              // for "Aujourd'hui" / budget KPIs (segment currency of display day)
  // Account base currency: controls display for Total wallets + Projection (not segment-dependent)
  const displayCurPivot = String((state?.user?.baseCurrency) || "EUR").toUpperCase();

  function _toEUR(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return a;

    if (typeof window.fxConvert === "function" && typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(dateISO || today);
      const rates = (typeof fxRatesForSegment === "function")
        ? fxRatesForSegment(seg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const out = window.fxConvert(a, c, "EUR", rates);
      if (out !== null && isFinite(out)) return out;
    }

    // fallback legacy (only reliable for BASE<->EUR)
    if (typeof amountToEUR === "function") return amountToEUR(a, c);
    return a;
  }

  function _toPivot(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const from = String(cur || "EUR").toUpperCase();
    const to = String(displayCurPivot || "EUR").toUpperCase();
    if (from === to) return a;

    // Prefer cross FX engine (supports non-EUR cross via EUR pivot)
    if (typeof window.fxConvert === "function" && typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(dateISO || today);
      const rates = (typeof fxRatesForSegment === "function")
        ? fxRatesForSegment(seg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const out = window.fxConvert(a, from, to, rates);
      if (out !== null && isFinite(out)) return out;
    }

    // Fallback: go through EUR
    const eur = _toEUR(a, from, dateISO);
    if (to === "EUR") return eur;
    try {
      const seg = (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate(dateISO || today) : null;
      const rates = (typeof fxRatesForSegment === "function")
        ? fxRatesForSegment(seg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const out2 = (typeof window.fxConvert === "function") ? window.fxConvert(eur, "EUR", to, rates) : null;
      if (out2 !== null && isFinite(out2)) return out2;
    } catch (_) {}
    return eur;
  }

  function _toPivotStrict(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const from = String(cur || "EUR").toUpperCase();
    const to = String(displayCurPivot || "EUR").toUpperCase();
    if (from === to) return a;
    try {
      if (typeof window.fxConvert === "function") {
        const direct = window.fxConvert(a, from, to);
        if (direct !== null && isFinite(direct)) return direct;
        const seg = (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate(dateISO || today) : null;
        const rates = (typeof fxRatesForSegment === "function")
          ? fxRatesForSegment(seg)
          : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
        const out = window.fxConvert(a, from, to, rates);
        if (out !== null && isFinite(out)) return out;
      }
    } catch (_) {}
    return null;
  }

  function _tripNetBalancesPivot(dateISO, rangeStartISO, rangeEndISO) {
    const rows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
      ? state.tripNetBalances
      : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
    const byTrip = new Map();
    for (const row of rows) {
      const net = Number(row?.net || 0);
      if (!Number.isFinite(net) || Math.abs(net) < 0.000001) continue;
      if (!_kpiTripNetRowInRange(row, rangeStartISO, rangeEndISO)) continue;
      const converted = _toPivotStrict(net, row?.currency || state?.period?.baseCurrency || "EUR", dateISO);
      if (converted === null || !isFinite(converted)) continue;
      const key = String(row?.tripId || row?.trip_id || row?.tripName || row?.trip_name || "trip");
      byTrip.set(key, (byTrip.get(key) || 0) + converted);
    }
    let out = 0;
    for (const v of byTrip.values()) {
      if (Math.abs(Number(v) || 0) >= 1) out += v;
    }
    return out;
  }

  // Total wallets:
  // - primary value in account base currency (pivot)
  // - secondary value in the current display segment currency (display date segment)
  let walletTotalEUR = 0; // kept name for backward compat in template
  let walletTotalBase = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);
    const cur = w.currency || "EUR";
    walletTotalEUR += _toPivot(bal, cur, displayDateISO);

    // Segment/base view for the current display date
    if (typeof window.amountToDisplayForDate === "function") {
      walletTotalBase += window.amountToDisplayForDate(bal, cur, displayDateISO);
    } else if (typeof window.amountToBudgetBaseForDate === "function") {
      walletTotalBase += window.amountToBudgetBaseForDate(bal, cur, displayDateISO);
    } else {
      walletTotalBase += bal;
    }
  }

  function _kpiResolveHorizonEndISO(scope, todayISO) {
    return window.TBKpiProjectionRules?.resolveKpiHorizonEnd?.(scope, todayISO, {
      period: state?.period || {},
      getBudgetSegmentForDate: (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate : null,
    }) ?? state?.period?.end;
  }
  const _kpiHorizonEndISO = _kpiResolveHorizonEndISO(kpiScope, displayDateISO);
  let pendingTransactionsEUR = 0;
  let pendingTripsDisplay = 0;
  let pendingDisplay = 0;
  let totalDisplay = walletTotalEUR;
  let projEndEUR = 0;
  let projEndDisplay = 0;
  let pendingDetailHTML = "";

  // =========================
  // KPI scope selector (V6.6.91)
  // - fixes ReferenceError: scopeOptionsHTML is not defined
  // - supports: segment / period / seg:<id> / range:<start>:<end>
  // =========================
  function _kpiParseScope(raw) {
    return window.TBKpiProjectionRules?.parseKpiScope?.(raw) || { kind: "segment", raw: String(raw || "segment") };
  }

  function _kpiResolveRange(parsed, refISO) {
    return window.TBKpiProjectionRules?.resolveKpiRange?.(parsed, refISO, {
      period: state?.period || {},
      getBudgetSegmentForDate: (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate : null,
    }) || { startISO: String(state?.period?.start || "").slice(0,10), endISO: String(state?.period?.end || "").slice(0,10) };
  }

  const _parsedScope = _kpiParseScope(kpiScope);
  const _rrPilot = _kpiResolveRange(_parsedScope, displayDateISO);
  const _scopeValForSelect = (_parsedScope.kind === "seg")
    ? `seg:${_parsedScope.segId}`
    : (_parsedScope.kind === "range")
      ? "range"
      : _parsedScope.kind;

  // Build scope options HTML once per render
  const _segs = Array.isArray(state?.budgetSegments) ? state.budgetSegments.slice() : [];
  _segs.sort((a,b) => String(a.start||a.start_date||"").localeCompare(String(b.start||b.start_date||"")));
  const _lang = (window.tbGetLang && tbGetLang()) || "fr";
  const _labSeg = (_lang === "en") ? "Current segment" : "Segment courant";
  const _labPeriod = (_lang === "en") ? "Whole period" : "Toute la période";
  const _labRange = (_lang === "en") ? "Date range…" : "Date à date…";
  const _labPer = (_lang === "en") ? "Period" : "Periode";

  function _pendingTxOverlaps(tx, rangeStartISO, rangeEndISO) {
    return window.TBKpiProjectionRules?.pendingTxOverlaps?.(tx, rangeStartISO, rangeEndISO) ?? true;
  }

  function _pendingAmountText(value, cur) {
    return window.TBKpiProjectionRules?.pendingAmountText?.(value, cur) || `${Math.round(Number(value) || 0)} ${cur || ""}`.trim();
  }

  function _pendingProjectionItems(rangeStartISO, rangeEndISO) {
    const tripRows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
      ? state.tripNetBalances
      : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
    return window.TBKpiProjectionRules?.pendingProjectionItems?.({
      transactions: state.transactions || [],
      tripRows,
      periods: state.periods || [],
      rangeStartISO,
      rangeEndISO,
      displayDateISO,
      baseCurrency: state?.period?.baseCurrency || "EUR",
      lang: _lang,
      isPendingTransaction: _kpiIsCashPendingProjectionTx,
      toPivot: _toPivot,
      toPivotStrict: _toPivotStrict,
      normalizeText: _kpiNormText,
    }) || [];
  }

  const _pendingRangeStartISO = String(_rrPilot.startISO || displayDateISO).slice(0, 10);
  const _pendingRangeEndISO = String(_rrPilot.endISO || _kpiHorizonEndISO || displayDateISO).slice(0, 10);
  pendingTransactionsEUR = includeUnpaid ? (Number(netPendingEUR(_pendingRangeStartISO, _pendingRangeEndISO)) || 0) : 0;
  pendingTripsDisplay = includeUnpaid ? _tripNetBalancesPivot(displayDateISO, _pendingRangeStartISO, _pendingRangeEndISO) : 0;
  pendingDisplay = includeUnpaid ? (_toPivot(pendingTransactionsEUR, "EUR", displayDateISO) + pendingTripsDisplay) : 0;
  totalDisplay = walletTotalEUR + (includeUnpaid ? pendingDisplay : 0);
  projEndEUR = projectedEndDisplayWithOptions({ includeUnpaid, scope: kpiScope, rangeStartISO: _pendingRangeStartISO, rangeEndISO: _pendingRangeEndISO });
  projEndDisplay = _toPivot(projEndEUR, "EUR", displayDateISO);
  if (includeUnpaid) {
    const items = _pendingProjectionItems(_pendingRangeStartISO, _pendingRangeEndISO);
    const empty = _lang === "en" ? "No receivable/payable item in this range." : "Aucun élément à recevoir / à payer dans cette plage.";
    const detailLabel = _lang === "en" ? "Details" : "Détail";
    const rangeLabel = `${_pendingRangeStartISO} → ${_pendingRangeEndISO}`;
    pendingDetailHTML = window.TBKpiView?.renderKpiPendingDetail?.({
      items,
      max: 8,
      rangeLabel,
      detailLabel,
      emptyLabel: empty,
      moreLabel: _lang === "en" ? "more" : "autre(s)",
      currency: displayCurPivot,
      amountText: _pendingAmountText,
      esc: escapeHTML,
    }) || "";
  }
  const scopeOptionsHTML = window.TBKpiView?.renderKpiScopeOptions?.({
    segments: _segs,
    segmentLabel: _labSeg,
    periodLabel: _labPeriod,
    segmentPrefix: _labPer,
    rangeLabel: _labRange,
    esc: escapeHTML,
  }) || "";

  const runway = cashRunwayInfo();        // dépenses cash réelles
  const cover  = cashConservativeInfo();  // burn prudent (budget/alloc)

 // 🔥 Cash fallback model (bank unavailable scenario)
// Stock = cash only
// Burn = total real expenses (runway)

const cashTotalBase = runway ? runway.totalBase : 0;
const cashBurnBase  = (runway && isFinite(runway.burnPerDay))
  ? runway.burnPerDay
  : 0;

const criticalDays = runway ? runway.daysLeft : Infinity;
const driver = "Dépenses";

  const todayDetailsHTML = _renderTodayDetailsHTML(displayDateISO);
  const todayBudget = getDailyBudgetForDate(displayDateISO);
  const activityToday = _kpiActivitySummaryForDate(displayDateISO);
  const healthToday = _kpiHealthSummaryForDate(displayDateISO, activityToday);
  const healthActions = _kpiHealthActionRows(healthToday);
  const todayPillClass = budgetClass(todayBudget);

  let level = "good";
  if (!isFinite(criticalDays)) level = "good";
  else if (criticalDays <= 2) level = "bad";
  else if (criticalDays <= 7) level = "warn";
  else level = "good";

  const daysText = !isFinite(criticalDays)
    ? "∞"
    : String(Math.max(0, Math.ceil(criticalDays)));

  const excluded = (cover?.excluded?.length ? cover.excluded : (runway?.excluded || []));
  const exclCurrencies = [...new Set(excluded.map(x => x.currency).filter(Boolean))];
  const fxNote = exclCurrencies.length ? `FX exclu : ${exclCurrencies.join(", ")}` : "";
  const pilot = _pilotageInsights({ kind: _parsedScope.kind, startISO: _rrPilot.startISO, endISO: _rrPilot.endISO });

  const activeTravel = (state.travels || []).find(x => String(x.id) === String(state?.activeTravelId || "")) || null;
  const activeTravelLabel = activeTravel
    ? String(activeTravel.name || "").trim() || `Voyage ${String(activeTravel.start || "").slice(0,10)} -> ${String(activeTravel.end || "").slice(0,10)}`
    : `Voyage ${String(state?.period?.start || "").slice(0,10)} -> ${String(state?.period?.end || "").slice(0,10)}`;
  const activeTravelValue = String(state?.activeTravelId || state?.period?.id || "");
  const travelOptionHTML = window.TBKpiView?.renderKpiTravelOption?.({
    value: activeTravelValue,
    label: activeTravelLabel,
    esc: escapeHTML,
  }) || "";
  const scopeHelpHTML = (typeof window.tbHelp === "function" && window.tbT) ? tbHelp(tbT("dashboard.help.scope")) : "";

  // Inject responsive CSS once
  if (!document.getElementById("kpiResponsiveStyles")) {
    const st = document.createElement("style");
    st.id = "kpiResponsiveStyles";
    st.textContent = window.TBKpiView?.renderKpiResponsiveStyles?.() || "";
    document.head.appendChild(st);
  }

  const kpiCardsHTML = window.TBKpiView?.renderKpiCards?.({
    cards: [
      { title: T("kpi.available_budget"), valueHtml: `${budgetToday.toFixed(0)} <span class="muted kpi-mini-unit">${escapeHTML(base)}</span>`, footerHtml: escapeHTML(T("kpi.today")) },
      { title: "Total wallets", valueHtml: `${escapeHTML(fmtKPICompact(walletTotalEUR))} <span class="muted kpi-mini-unit">${escapeHTML(displayCurPivot)}</span>`, footerHtml: `≈ ${escapeHTML(fmtKPICompact(walletTotalBase))} ${escapeHTML(displayCur)}` },
      { title: "Sport fait", valueHtml: `${Math.round(activityToday.sportKcal)} <span class="muted kpi-mini-unit">kcal</span>`, footerHtml: `${Math.round(activityToday.sportCount)} séance(s)` },
      { title: "Travail fait", valueHtml: `${Math.round(activityToday.workKcal)} <span class="muted kpi-mini-unit">kcal</span>`, footerHtml: `${Math.round(activityToday.workMinutes / 60 * 10) / 10}h · ${Math.round(activityToday.workCount)} journée(s)` },
      { title: T("kpi.fx_period"), valueHtml: escapeHTML(fxRateText), footerHtml: escapeHTML(T("kpi.fx_period_hint")), compact: true },
    ],
    healthToday,
    healthActions,
    pendingToggle: {
      card: { title: T("kpi.period_end"), valueHtml: `${escapeHTML(fmtKPICompact(projEndDisplay))} <span class="muted kpi-mini-unit">${escapeHTML(displayCurPivot)}</span>`, footerHtml: escapeHTML(T("kpi.projection")) },
      toggle: {
        includeUnpaid,
        label: T("kpi.include_pending"),
        netLabel: "Net",
        pendingDisplay,
        currency: displayCurPivot,
        pendingDetailHtml: pendingDetailHTML,
      },
    },
    fxCalculatorTitle: tbT ? tbT("kpi.fxcalc.title") : "Convertisseur",
    esc: escapeHTML,
  }) || "";

  const todayPanelHTML = window.TBKpiView?.renderKpiTodayPanel?.({
    dateISO: displayDateISO,
    todayLabel: T("kpi.today"),
    steeringLabel: T("kpi.steering"),
    dailyBudget: todayBudget,
    base,
    todayPillClass,
    todayDetailsHtml: todayDetailsHTML,
    pilot,
    recommendedBudgetLabel: T("kpi.recommended_budget"),
    recommendedBudgetRangeLabel: T("kpi.recommended_budget_range"),
    endBalanceLabel: T("kpi.end_balance"),
    rangeEndBalanceLabel: T("kpi.range_end_balance"),
    estimatedBreakLabel: T("kpi.estimated_break"),
    daysRemainingLabel: T("kpi.days_remaining"),
    cashLabel: "Cash",
    daysLabel: T("kpi.days"),
    stockLabel: T("kpi.stock"),
    burnLabel: T("kpi.burn"),
    cashDaysText: daysText,
    cashLevel: level,
    cashDriver: driver,
    cashTotalText: fmtMoney(cashTotalBase, base),
    cashBurnText: fmtMoney(cashBurnBase, base),
    fxNote,
    moneyText: fmtMoney,
    signPillClass: _signPillClass,
    esc: escapeHTML,
  }) || "";

  // #kpi container is already a .card in index.html; avoid nesting cards.
  kpi.innerHTML = `
      ${window.TBKpiView?.renderKpiHeader?.({
        title: "KPIs",
        travelOptionHtml: travelOptionHTML,
        scopeOptionsHtml: scopeOptionsHTML,
        scopeValue: _scopeValForSelect,
        helpHtml: scopeHelpHTML,
        dateISO: displayDateISO,
        esc: escapeHTML,
      }) || ""}

      ${window.TBKpiView?.renderKpiMainLayout?.({
        cardsHtml: kpiCardsHTML,
        todayPanelHtml: todayPanelHTML,
      }) || ""}
  `;

  window.TBKpiView?.bindKpiInteractions?.({
    root: kpi,
    scope: kpiScope,
    scopeValue: _scopeValForSelect,
    displayDateISO,
    parseScope: _kpiParseScope,
    resolveRange: _kpiResolveRange,
    constants: TB_CONST,
    storage: localStorage,
    state,
    base,
    rates: (typeof window.fxGetEurRates === "function") ? (window.fxGetEurRates() || {}) : {},
    fxConvert: window.fxConvert,
    amountToEUR: (typeof amountToEUR === "function") ? amountToEUR : null,
    eurToAmount: (typeof eurToAmount === "function") ? eurToAmount : null,
    renderKPI,
    requestRenderAll: window.tbRequestRenderAll,
    ensureCashflowCurve: window.tbEnsureCashflowCurve,
    requestCashflowRender: window.tbRequestCashflowRender,
    renderCashflowChart: window.renderCashflowChart || (typeof renderCashflowChart === "function" ? renderCashflowChart : null),
    redrawCharts: window.redrawCharts,
  });

  })();
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("kpi:render"); } catch (_) {}
  return __out;
}

