/* =========================
   KPI + Render (micro animation)
   ========================= */

function budgetClass(v) {
  if (v >= state.period.dailyBudgetBase * 0.7) return "good";
  if (v >= state.period.dailyBudgetBase * 0.35) return "warn";
  return "bad";
}

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

// Budget spent (base currency) for a given day.
// - includes Trip shares paid by someone else (payNow=false) because they impact budget
// - excludes out-of-budget expenses
// - distributes multi-day expenses evenly across covered days
function budgetSpentBaseForDate(dateStr) {
  try {
    const txs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    const target = String(dateStr || "");
    if (!target) return 0;

    let sum = 0;
    for (const t of txs) {
      const type = String(t?.type || "").toLowerCase();
      if (type !== "expense") continue;

      const affectsBudget = (t.affectsBudget === undefined || t.affectsBudget === null) ? true : !!t.affectsBudget;
      if (!affectsBudget) continue;

      const outOfBudget = !!t.outOfBudget || !!t.out_of_budget;
      if (outOfBudget) continue;

      const s = parseISODateOrNull(t.dateStart || t.date_start || t.date || null);
      const e = parseISODateOrNull(t.dateEnd || t.date_end || t.dateStart || t.date_start || t.date || null);
      if (!s || !e) continue;

      const sds = toLocalISODate(s);
      const eds = toLocalISODate(e);
      if (target < sds || target > eds) continue;

      const amt = safeNum(t.amount);
      if (!isFinite(amt) || amt === 0) continue;

      const days = dayCountInclusive(s, e);
      const perDayInTxCur = amt / days;

      const perDayBase = (typeof amountToBudgetBaseForDate === "function")
        ? amountToBudgetBaseForDate(perDayInTxCur, t.currency, target)
        : amountToBase(perDayInTxCur, t.currency);

      sum += perDayBase;
    }

    return sum;
  } catch (_) {
    return 0;
  }
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
    if (!tx) continue;
    if (tx.isInternal) continue;
    const _p = (tx.payNow ?? tx.pay_now);
    const _paid = (_p === undefined) ? true : !!_p;
    if (_paid) continue;
    if (!_txOverlaps(tx)) continue;

    const v = amountToEUR(Number(tx.amount) || 0, tx.currency);
    if (tx.type === "income") net += v;
    else if (tx.type === "expense") net -= v;
  }
  return net;
}

function fmtKPICompact(v) {
  const n = Number(v);
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e7) {
    try {
      return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
    } catch (_) {}
  }
  return String(Math.round(n));
}

function projectedEndDisplayWithOptions(opts) {
  // KPI "Fin période":
  //   trésorerie actuelle (wallets) - prévision quotidienne (budget/jour) jusqu'à la fin
  //   + optionnel: inclure les entrées/dépenses non payées/reçues (toggle)
  // Par défaut, l'horizon = segment courant. opts.scope='period' => horizon = fin de période.

  const includeUnpaid = !!opts?.includeUnpaid;
  const scope = String(opts?.scope || "segment").toLowerCase();
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

    // Live ECB cache
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
  const horizonStartISO = todayISO;

  // Horizon end
  let horizonEndISO = state?.period?.end;
  try {
    if (scope !== "period" && typeof getBudgetSegmentForDate === "function") {
      const seg0 = getBudgetSegmentForDate(todayISO);
      if (seg0 && (seg0.end || seg0.end_date)) horizonEndISO = String(seg0.end || seg0.end_date);
    }
  } catch (_) {}

  const pendingEUR = includeUnpaid ? (Number(netPendingEUR(horizonStartISO, horizonEndISO)) || 0) : 0;

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
        if (typeof getBudgetSegmentForDate === "function") {
          const seg = getBudgetSegmentForDate(ds);
          if (seg) {
            const segCur = String(seg?.baseCurrency || seg?.base_currency || "").toUpperCase();
            const segDaily = Number(seg?.dailyBudgetBase ?? seg?.daily_budget_base);
            if (segCur) cur = segCur;
            if (Number.isFinite(segDaily)) daily = segDaily;
          }
        }
      } catch (_) {}

      forecastEUR += _toEURSafe(daily, cur, ds);
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
  const ws = (state.wallets || []);
  // Strict and deterministic: cash KPI = wallets explicitly typed as cash.
  return ws.filter(w => String(w?.type || "").toLowerCase() === "cash");
}

// Amount convertible to BASE with current engine:
// - BASE currency itself
// - EUR (via EUR-BASE)
// Otherwise: not convertible (FX missing)
function _toBaseSafe(amount, currency) {
  const base = (typeof window.getDisplayCurrency === 'function') ? window.getDisplayCurrency(window.getDisplayDateISO()) : state?.period?.baseCurrency;
  const cur = String(currency || "");
  const amt = Number(amount) || 0;

  if (!base || !cur) return { ok: false, v: 0 };

  // ✅ If cross-rate plugin is present, use it
  if (typeof window.fxConvert === "function") {
    const out = window.fxConvert(amt, cur, base);
    if (out === null) return { ok: false, v: 0 };
    return { ok: true, v: out };
  }

  // Fallback (old engine)
  if (cur === base) return { ok: true, v: amt };
  if (cur === "EUR") {
    const r = Number(state.exchangeRates["EUR-BASE"]) || 0;
    if (!r) return { ok: false, v: 0 };
    return { ok: true, v: amt * r };
  }

  return { ok: false, v: 0 };
}


function _sumCashWalletsBase() {
  const base = (typeof window.getDisplayCurrency === 'function') ? window.getDisplayCurrency(window.getDisplayDateISO()) : state?.period?.baseCurrency;
  let totalBase = 0;
  const excluded = []; // {name,currency,balance}

  for (const w of _getCashWallets()) {
    const cur = w.currency || base;
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);

    // If the wallet is empty, don't surface it as "FX exclu"
    if (!bal) continue;

    const conv = _toBaseSafe(bal, cur);

    if (conv.ok) totalBase += conv.v;
    else excluded.push({ name: w.name || "Wallet", currency: cur, balance: bal });
  }

  return { totalBase, excluded };
}

/* =========================
   Cash runway (UX): based on real cash expenses
   ========================= */
function cashRunwayInfo(windowDays = 7) {
  const cashWallets = _getCashWallets();
  if (!cashWallets.length) return null;

  const { totalBase, excluded } = _sumCashWalletsBase();
  const base = state.period.baseCurrency;

  const cashWalletIds = new Set(cashWallets.map(w => w.id));

  const today = clampMidnight(new Date());

  // Prefer since period start; else last N days
  const ps = parseISODateOrNull(state?.period?.start);
  const start = ps ? clampMidnight(ps) : (() => {
    const s = new Date(today);
    s.setDate(s.getDate() - Math.max(1, Number(windowDays) || 7) + 1);
    return clampMidnight(s);
  })();

  let sumExpenseBase = 0;

  function _normStr(s) {
    try {
      return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    } catch (_) {
      return String(s || "").toLowerCase().trim();
    }
  }

  function _isInternalMovement(tx) {
    // Exclude internal transfers from "burn" (cash runway), e.g. cash↔bank moves.
    const cat = _normStr(tx?.category);
    const label = _normStr(tx?.label);
    if (cat === "mouvement interne" || cat === "internal movement") return true;
    if (label.includes("[internal]") || label.includes("mouvement interne")) return true;
    return false;
  }


  for (const tx of (state.transactions || [])) {
    if (!tx) continue;
    if (tx.type !== "expense") continue;
    if (_isInternalMovement(tx)) continue;
    const _p2 = (tx.payNow ?? tx.pay_now);
    const _paid2 = (_p2 === undefined) ? true : !!_p2;
    if (!_paid2) continue; // runway = real cash out
    const txWid = String(tx.walletId ?? tx.wallet_id ?? "");
    if (!cashWalletIds.has(txWid)) continue;

    const d = parseISODateOrNull(tx.dateStart);
    if (!d) continue;
    const dd = clampMidnight(d);
    if (dd < start || dd > today) continue;

    const cur = tx.currency || base;
    const conv = _toBaseSafe(Number(tx.amount) || 0, cur);
    if (conv.ok) sumExpenseBase += conv.v;
  }

  const days = Math.max(1, dayCountInclusive(start, today));
  const burnPerDay = sumExpenseBase / days;

  const daysLeft = (burnPerDay > 0) ? (totalBase / burnPerDay) : Infinity;

  return {
    totalBase,
    burnPerDay,
    daysLeft,
    excluded,
    windowDays: days,
  };
}

/* =========================
   Cash conservative cover (UX): based on allocations/budget usage
   ========================= */
function cashConservativeInfo() {
  const cashWallets = _getCashWallets();
  if (!cashWallets.length) return null;

  const { totalBase, excluded } = _sumCashWalletsBase();
  const base = state.period.baseCurrency;

  const today = clampMidnight(new Date());
  const ps = parseISODateOrNull(state?.period?.start);
  const start = ps ? clampMidnight(ps) : clampMidnight(new Date(today));

  // measure completed days (to yesterday)
  const end = new Date(today);
  end.setDate(end.getDate() - 1);

  let sumAllocated = 0;
  let activeDays = 0;

  const s = start;
  const e = (end >= start) ? end : today;

  forEachDateInclusive(s, e, (d) => {
    const ds = toLocalISODate(d);
    if (!periodContains(ds)) return;

    const remaining = getDailyBudgetForDate(ds);
    const allocated = (Number(state.period.dailyBudgetBase || 0) - remaining);

    if (allocated > 0) {
      sumAllocated += allocated;
      activeDays += 1;
    }
  });

  const burnPerDay =
    (activeDays > 0) ? (sumAllocated / activeDays) : Number(state.period.dailyBudgetBase || 0);

  const daysLeft = (burnPerDay > 0) ? (totalBase / burnPerDay) : Infinity;

  return {
    totalBase,
    burnPerDay,
    daysLeft,
    excluded,
    activeDays,
  };
}

function _daysPill(daysLeft, labelPrefix) {
  const thresholds = { warn: 7, urgent: 4, critical: 2 };

  if (!isFinite(daysLeft)) {
    return { level: "good", text: `${labelPrefix}: ∞` };
  }

  const dl = Math.max(0, daysLeft);
  const j = Math.ceil(dl);

  if (dl <= thresholds.critical) return { level: "bad", text: `${labelPrefix}: J-${j} (URGENT)` };
  if (dl <= thresholds.urgent) return { level: "warn", text: `${labelPrefix}: J-${j} (bientôt)` };
  if (dl <= thresholds.warn) return { level: "warn", text: `${labelPrefix}: J-${j}` };
  return { level: "good", text: `${labelPrefix}: ~${Math.floor(dl)} j` };
}

function _renderTodayDetailsHTML(dateStr) {
  // Reprend la logique "allocations" (ce que tu vois dans Budget journalier)
  const info = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(dateStr)
    : { baseCurrency: state?.period?.baseCurrency };
  const fallbackBase = String(info?.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();

  const details = (state.allocations || []).filter(a => a && a.dateStr === dateStr);

  if (!details.length) {
    return `<div class="muted" style="margin-top:8px;">Aucun détail</div>`;
  }

  // Même rendu que ton budget journalier : liste à puces
  return `
    <div style="margin-top:10px; line-height:1.55;">
      ${details.map(x =>
        `• ${escapeHtml(x.label)} : ${Math.round(x.amountBase)} ${String(x.baseCurrency || fallbackBase).toUpperCase()}`
      ).join("<br>")}
    </div>
  `;
}

// mini helper: évite l'injection HTML via label
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function _pilotageInsights() {
  const today = toLocalISODate(new Date());
  const infoToday = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(today)
    : { remaining: getDailyBudgetForDate(today), daily: state?.period?.dailyBudgetBase || 0, baseCurrency: state?.period?.baseCurrency || "EUR" };

  const base = String(infoToday.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();
  let end = state?.period?.end;

  // If a budget segment exists for the display day, use its end as the projection horizon
  try {
    if (typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(today);
      if (seg && (seg.end || seg.end_date)) end = String(seg.end || seg.end_date);
    }
  } catch (_) {}


  if (!base || !end) return null;

  const todayD = parseISODateOrNull(today);
  const endD = parseISODateOrNull(end);
  if (!todayD || !endD) return null;

  // jours restants incluant aujourd’hui
  const daysRemaining = Math.max(1, dayCountInclusive(clampMidnight(todayD), clampMidnight(endD)));

  const currentDaily = Number(infoToday.daily || 0);
  const balanceBase = _sumWalletsDisplay(today);

  // Cible: finir à 0 (on pourra rendre paramétrable plus tard)
  const targetEnd = 0;

  const recommendedDaily = (balanceBase - targetEnd) / daysRemaining;

  // Si tu gardes ton budget actuel, où tu finis ?
  const projectedEndBalance = balanceBase - (currentDaily * daysRemaining);

  // Jusqu’à quand tu tiens avec le budget actuel (date estimée)
  const daysAtCurrent = (currentDaily > 0) ? Math.floor(balanceBase / currentDaily) : Infinity;
  const zeroDate = isFinite(daysAtCurrent)
    ? _addDaysISO(today, Math.max(0, daysAtCurrent))
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
    base,
    today,
    end,
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
  if (v >= 0) return "good";
  // négatif : on passe warn puis bad
  const abs = Math.abs(v);
  if (abs < (state.period.dailyBudgetBase || 1) * 3) return "warn";
  return "bad";
}

/* =========================
   KPI render
   ========================= */
function renderKPI() {
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("kpi:render"); } catch (_) {}
  const __out = (function(){

  const kpi = document.getElementById("kpi");

  // ✅ GUARD: si la vue n'a pas encore monté le conteneur KPI, on ne fait rien.
  if (!kpi) return;

  const today = toLocalISODate(new Date());
  // Display date can later be driven by UI (state.uiDateISO). If absent, it defaults to today.
  const displayDateISO = (typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : today;
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
  const displayCurPivot = "EUR";        // pivot for Total wallets + Projection

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

  // Total wallets:
  // - primary value in EUR (pivot) to keep a stable, comparable figure
  // - secondary value in the current display segment currency (display date segment)
  let walletTotalEUR = 0;
  let walletTotalBase = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);
    const cur = w.currency || "EUR";
    walletTotalEUR += _toEUR(bal, cur, displayDateISO);

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
    let endISO = state?.period?.end;
    try {
      if (String(scope||"segment").toLowerCase() !== "period" && typeof getBudgetSegmentForDate === "function") {
        const seg0 = getBudgetSegmentForDate(todayISO);
        if (seg0 && (seg0.end || seg0.end_date)) endISO = String(seg0.end || seg0.end_date);
      }
    } catch (_) {}
    return endISO;
  }
  const _kpiHorizonEndISO = _kpiResolveHorizonEndISO(kpiScope, displayDateISO);
  const pendingDisplay = includeUnpaid ? (Number(netPendingEUR(displayDateISO, _kpiHorizonEndISO)) || 0) : 0; // EUR (only for Projection UI)
  const totalDisplay = walletTotalEUR + (includeUnpaid ? pendingDisplay : 0); // kept for backward compat of internal uses

  const projEndDisplay = projectedEndDisplayWithOptions({ includeUnpaid, scope: kpiScope });

  const runway = cashRunwayInfo();        // dépenses cash réelles
  const cover  = cashConservativeInfo();  // burn prudent (budget/alloc)

  const cashTotalBase = cover ? cover.totalBase : (runway ? runway.totalBase : 0);
  const cashBurnBase  = cover ? cover.burnPerDay : (runway ? runway.burnPerDay : 0);

  const runwayDays = runway ? runway.daysLeft : Infinity;
  const coverDays  = cover  ? cover.daysLeft  : Infinity;

  const criticalDays = Math.min(runwayDays, coverDays);
  const driver = (criticalDays === runwayDays) ? "Dépenses" : "Budget";

  const todayDetailsHTML = _renderTodayDetailsHTML(displayDateISO);
  const todayBudget = getDailyBudgetForDate(displayDateISO);
  const todayBudgetSpent = budgetSpentBaseForDate(displayDateISO);
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
  const pilot = _pilotageInsights();

  const miniCardStyle = `
    border:1px solid rgba(0,0,0,0.06);
    border-radius:16px;
    padding:14px;
    background:rgba(0,0,0,0.015);
  `;

  // Inject responsive CSS once
  if (!document.getElementById("kpiResponsiveStyles")) {
    const st = document.createElement("style");
    st.id = "kpiResponsiveStyles";
    st.textContent = `
      .kpi-layout { grid-template-columns: 520px 1fr; }
      .kpi-mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap:14px; }

      @media (max-width: 1100px) {
        .kpi-layout { grid-template-columns: 1fr; }
      }

      @media (max-width: 720px) {
        .kpi-mini-grid { grid-template-columns: 1fr; }
      }

      @media (max-width: 480px) {
        .kpi-mini-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(st);
  }

  // #kpi container is already a .card in index.html; avoid nesting cards.
  kpi.innerHTML = `
      <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px;">
        <h2 style="margin:0;">KPIs</h2>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
  <select id="kpiPeriodSelect" style="padding:6px 8px;border:1px solid rgba(0,0,0,0.12);border-radius:10px;font-size:12px;background:#fff;">
    ${ (state.periods || []).map(pp => `<option value="${pp.id}" ${pp.id===state.period.id?"selected":""}>${pp.start} → ${pp.end} (${pp.baseCurrency||""})</option>`).join("") }
  </select>
  <select id="kpiScopeSelect" style="padding:6px 8px;border:1px solid rgba(0,0,0,0.12);border-radius:10px;font-size:12px;background:#fff;">
    <option value="segment" ${kpiScope === "segment" ? "selected" : ""}>Segment courant</option>
    <option value="period" ${kpiScope === "period" ? "selected" : ""}>Toute la période</option>
  </select>
  <div class="muted" style="font-size:12px;">${displayDateISO}</div>
</div>
      </div>

      <div class="kpi-layout" style="display:grid; gap:16px; margin-top:14px; align-items:start;">

        <!-- LEFT: KPIs -->
        <div>
          <!-- KPI mini-cards -->
          <div class="kpi-mini-grid" style="display:grid; gap:14px;">
            <div style="${miniCardStyle}">
              <div class="muted" style="font-size:12px;">Budget dispo</div>
              <div style="font-weight:800; font-size:26px; line-height:1.1; margin-top:6px; color:var(--text);">
                ${budgetToday.toFixed(0)} <span style="font-weight:700; font-size:14px;" class="muted">${base}</span>
              </div>
              <div class="muted" style="font-size:12px; margin-top:6px;">Aujourd’hui</div>
            </div>

            <div style="${miniCardStyle}">
              <div class="muted" style="font-size:12px;">Total wallets</div>
              <div style="font-weight:800; font-size:26px; line-height:1.1; margin-top:6px; color:var(--text);">
                ${fmtKPICompact(walletTotalEUR)} <span style="font-weight:700; font-size:14px;" class="muted">${displayCurPivot}</span>
              </div>
	              <div class="muted" style="font-size:12px; margin-top:6px;">
	                ≈ ${fmtKPICompact(walletTotalBase)} ${displayCur}
	              </div>
	            </div>

            <div style="${miniCardStyle}">
              <div class="muted" style="font-size:12px;">Fin période</div>
              <div style="font-weight:800; font-size:26px; line-height:1.1; margin-top:6px; color:var(--text);">
                ${fmtKPICompact(projEndDisplay)} <span style="font-weight:700; font-size:14px;" class="muted">${displayCurPivot}</span>
              </div>
              <div class="muted" style="font-size:12px; margin-top:6px;">Projection</div>
              <label class="muted" style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;user-select:none;">
                <input id="kpiIncludeUnpaidToggle" type="checkbox" ${includeUnpaid ? "checked" : ""} />
                Inclure à recevoir / à payer
                ${includeUnpaid ? `<span style="margin-left:auto;opacity:.85;">Net: <strong style="color:var(--text);">${Math.round(pendingDisplay)} ${displayCurPivot}</strong></span>` : ``}
              </label>
            </div>

	            <div style="${miniCardStyle}">
	              <div class="muted" style="font-size:12px;">FX (période)</div>
	              <div style="font-weight:800; font-size:18px; line-height:1.2; margin-top:6px; color:var(--text);">${escapeHTML(fxRateText)}</div>
	              <div class="muted" style="font-size:12px; margin-top:6px;">1€ en devise de période</div>
	            </div>
          </div>

          <!-- CASH card -->
          <div style="${miniCardStyle} margin-top:14px;">
            <div class="muted" style="font-size:12px;">Cash</div>

            <div style="display:flex; align-items:baseline; gap:10px; margin-top:8px;">
              <div style="font-weight:900; font-size:36px; line-height:1; color:var(--text);">
                ${daysText}
              </div>
              <div class="muted" style="font-weight:700;">jours</div>

              <span class="pill ${level}" style="margin-left:auto;">
                <span class="dot"></span>${driver}
              </span>
            </div>

            <div class="muted" style="font-size:12px; margin-top:8px;">
              Stock : <strong style="color:var(--text);">${fmtMoney(cashTotalBase, base)}</strong>
              <span style="margin:0 8px;">•</span>
              Burn : <strong style="color:var(--text);">${fmtMoney(cashBurnBase, base)}/j</strong>
            </div>

            ${fxNote ? `<div class="muted" style="font-size:12px; margin-top:6px; color:var(--warn);">${fxNote}</div>` : ``}
          </div>
        </div>

        <!-- RIGHT: Today details -->
        <div style="${miniCardStyle}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div>
              <div style="font-weight:800; font-size:16px; color:var(--text);">Aujourd’hui</div>
              <div class="muted" style="font-size:12px; margin-top:2px;">${displayDateISO}</div>
            </div>
            <span class="pill ${todayPillClass}">
              <span class="dot"></span>${todayBudget.toFixed(0)} ${base}
            </span>
          </div>

          ${todayDetailsHTML}
          ${pilot ? `
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.06);">
              <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px;">
                <div style="font-weight:800; font-size:16px; color:var(--text);">Pilotage</div>
                <span class="pill ${pilot.decisionLevel}">
                  <span class="dot"></span>${pilot.decision}
                </span>
              </div>

              <div class="muted" style="font-size:12px; margin-top:8px;">
                <div style="display:flex; justify-content:space-between; gap:10px;">
                  <span>Budget recommandé</span>
                  <strong style="color:var(--text);">${fmtMoney(pilot.recommendedDaily, pilot.base)}/j</strong>
                </div>

                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;">
                  <span>Fin période (si budget actuel)</span>
                  <span class="pill ${_signPillClass(pilot.projectedEndBalance)}" style="padding:4px 10px;">
                    <span class="dot"></span>${fmtMoney(pilot.projectedEndBalance, pilot.base)}
                  </span>
                </div>

                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;">
                  <span>Date “0” (budget actuel)</span>
                  <strong style="color:var(--text);">${pilot.zeroDate}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;">
                  <span>Jours restants</span>
                  <strong style="color:var(--text);">${pilot.daysRemaining}</strong>
                </div>
              </div>
            </div>
          ` : ``}
        </div>
      </div>
  `;

  // Bind KPI selectors (period + scope) for projection horizon
  try {
    const selP = kpi.querySelector("#kpiPeriodSelect");
    const selS = kpi.querySelector("#kpiScopeSelect");

    // Keep UI aligned with persisted values after each render
    if (selS) {
      try { selS.value = String(kpiScope || "segment"); } catch (_) {}
    }

    if (selP && !selP.dataset.bound) {
      selP.dataset.bound = "1";
      selP.addEventListener("change", async (e) => {
        const v = String(e?.target?.value || "");
        if (!v) return;
        try { localStorage.setItem(ACTIVE_PERIOD_KEY, v); } catch (_) {}

        // Full refresh to load wallets/tx/segments for the selected period
        if (typeof refreshFromServer === "function") {
          await refreshFromServer();
        } else if (typeof loadFromSupabase === "function") {
          await loadFromSupabase();
          if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("kpi-micro"); else if (typeof renderAll === "function") renderAll();
        }
      });
    }

    if (selS && !selS.dataset.bound) {
      selS.dataset.bound = "1";
      selS.addEventListener("change", (e) => {
        const v = String(e?.target?.value || "segment");
        try { localStorage.setItem("travelbudget_kpi_projection_scope_v1", v); } catch (_) {}
        try { if (typeof renderKPI === "function") renderKPI(); } catch (_) {}
        // Keep curve aligned with KPI scope (no separate curve filter)
        try {
          if (typeof window.tbRequestCashflowRender === "function") window.tbRequestCashflowRender("kpi-scope-change");
          else if (typeof window.renderCashflowChart === "function") window.renderCashflowChart();
          else if (typeof renderCashflowChart === "function") renderCashflowChart();
        } catch (_) {}
});
    }
  } catch (e) {
    console.warn(e);
  }

  // Toggle: include unpaid (forecast) in KPI projection
  const _tog = document.getElementById("kpiIncludeUnpaidToggle");
  if (_tog) {
    _tog.onchange = () => {
      localStorage.setItem("travelbudget_kpi_projection_include_unpaid_v1", _tog.checked ? "1" : "0");
      if (window.tbRequestRenderAll) tbRequestRenderAll("kpi:toggle"); else renderKPI();
    };
  }

  })();
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("kpi:render"); } catch (_) {}
  return __out;
}
