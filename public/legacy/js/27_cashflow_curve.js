/* =========================
   Cashflow curve (réel + prévision) — ApexCharts
   - Réel: solde jour par jour (wallets + transactions payées, réparties sur dateStart/dateEnd)
   - Prévision: réel + (-budget/jour) + impayés (dépenses à payer / rentrées à recevoir) selon toggles
   - Dépensé/jour: barres sur les jours passés (expenses payées, affects_budget=true, hors out_of_budget & internal)
   - Seuils: 500€ et 0
   - Robustesse: jamais de NaN, message "pas de données" si besoin
   - Globals: window.renderCashflowChart, window.__cashflowChart
   ========================= */

(function () {

  // --- local fallbacks (avoid hard dependency on other helpers) ---
  function _toISODate(d) {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const da = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  function _parseISODate(s) {
    if (!s) return null;
    const str = String(s).slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
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
    cur.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    while (cur <= last) {
      fn(new Date(cur));
      cur = _addDays(cur, 1);
    }
  }

  let chart = null;

  // UI state
  let includePendingExpenses = (localStorage.getItem("cashflow_include_pending_exp_v1") ?? "1") === "1";
  let includePendingIncomes = (localStorage.getItem("cashflow_include_pending_inc_v1") ?? "1") === "1";

  // Segment filter (range + display currency for the chart)
  // Curve scope follows KPI scope (single source of truth)
  const KPI_SCOPE_KEY = "travelbudget_kpi_projection_scope_v1";
  function getKpiScope() {
    try { return String(localStorage.getItem(KPI_SCOPE_KEY) || "segment").toLowerCase(); } catch (_) { return "segment"; }
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

  function getSelectedSegment() {
    const scope = getKpiScope();
    if (scope === "period") return null; // whole period
    return getTodaySegment(); // current segment
  }

  function segLabel(seg) {
    if (!seg) return "";
    const s = String(seg.start || "").slice(0, 10);
    const e = String(seg.end || "").slice(0, 10);
    const c = String(seg.baseCurrency || "").toUpperCase();
    const range = (s && e) ? `${s} → ${e}` : (s || e || "");
    return `${range}${c ? ` (${c})` : ""}`.trim();
  }

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
    } catch (_) { }
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
    } catch (_) { }
  }

  function saveExcludedCats() {
    try { localStorage.setItem(CASHFLOW_CATS_KEY, JSON.stringify(Array.from(excludedCats))); } catch (_) { }
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
      _renderScheduled = true;
      setTimeout(_runQueuedRender, 0);
      return;
    }
    _renderWanted = false;
    _renderInFlight = true;

    Promise.resolve()
      .then(() => new Promise((resolve) => setTimeout(resolve, 0))) // let DOM/localStorage settle
      .then(() => renderCashflowChart())
      .catch(() => { })
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

  function base() {
    const seg = getSelectedSegment();
    if (seg && seg.baseCurrency) return String(seg.baseCurrency || "").toUpperCase();
    const d = todayStr();
    if (typeof window.getDisplayCurrency === "function") return String(window.getDisplayCurrency(d) || "").toUpperCase();
    return String(window.state?.period?.baseCurrency || "").toUpperCase();
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

  function toBase(amount, cur) {
    const b = base();
    const a = safeNum(amount);
    const c = String(cur || b).toUpperCase();

    if (!b) return a;

    // If a specific segment is selected, convert using that segment's FX overrides
    // without relying on the global display-currency mechanism.
    const selSeg = getSelectedSegment();
    if (selSeg && typeof window.fxConvert === "function") {
      const rates = (typeof window.fxRatesForSegment === "function")
        ? window.fxRatesForSegment(selSeg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const v = window.fxConvert(a, c, b, rates);
      return (v === null || !Number.isFinite(v)) ? 0 : v;
    }

    // Fallback: global conversion
    if (typeof window.safeFxConvert === "function") {
      const v = window.safeFxConvert(a, c, b, null);
      return (v === null || !Number.isFinite(v)) ? 0 : v;
    }
    if (typeof window.fxConvert === "function") {
      const v = window.fxConvert(a, c, b);
      return (v === null || !Number.isFinite(v)) ? 0 : v;
    }
    return a;
  }

  function getWalletsBalanceBase() {
    const wallets = Array.isArray(window.state?.wallets) ? window.state.wallets : [];
    let sum = 0;
    wallets.forEach((w) => {
      if (!w) return;
      const bal = safeNum(w.balance ?? w.amount ?? 0);
      const cur = String(w.currency || base() || "").toUpperCase();
      sum += toBase(bal, cur);
    });
    return sum;
  }

  // Build paid & pending deltas per date
  function buildSeries() {
    const txs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    const seg = getSelectedSegment();

    // Determine chart range (scope-aligned with KPI)
    let start = null;
    let end = null;

    if (seg) {
      start = _parseISODate(seg.start);
      end = _parseISODate(seg.end);
    } else {
      // Whole period: derive from state.period or min/max tx dates
      const p = window.state?.period || {};
      start = _parseISODate(p.start || p.dateStart || p.from);
      end = _parseISODate(p.end || p.dateEnd || p.to);

      if (!start || !end) {
        // fallback from tx dates
        let minD = null, maxD = null;
        txs.forEach((t) => {
          const d = _parseISODate(t?.date || t?.created_at || t?.at);
          if (!d) return;
          if (!minD || d < minD) minD = d;
          if (!maxD || d > maxD) maxD = d;
        });
        start = start || minD;
        end = end || maxD;
      }
    }

    if (!start || !end) return { ok: false, reason: "Période introuvable." };

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Today marker
    const tStr = todayStr();
    const tDate = _parseISODate(tStr);
    if (tDate) tDate.setHours(0, 0, 0, 0);

    const b = base();
    if (!b) return { ok: false, reason: "Devise base manquante." };

    // Determine budget/day (from segment if available)
    let dailyBudget = 0;
    if (seg) {
      dailyBudget = safeNum(seg.dailyBudget ?? seg.budgetPerDay ?? seg.daily_budget ?? 0);
      // Sometimes stored as total budget => compute daily by days count; keep existing behavior if helper exists
      if (!dailyBudget && safeNum(seg.totalBudget ?? seg.budgetTotal ?? 0)) {
        const total = safeNum(seg.totalBudget ?? seg.budgetTotal ?? 0);
        const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
        dailyBudget = total / days;
      }
    } else {
      dailyBudget = safeNum(window.state?.period?.dailyBudget ?? window.state?.period?.budgetPerDay ?? 0);
    }

    // Current balance in base (wallets)
    const currentBalance = round2(getWalletsBalanceBase());
    const startBalance = currentBalance; // engine baseline = wallets now, then replay deltas by date

    // Buckets
    const paidNet = {};
    const paidSpentAll = {};
    const paidSpentBudget = {};

    const pendingNetExp = {};
    const pendingNetInc = {};

    // Budget spent helper (if exists)
    const budgetSpentFn = (typeof window.getBudgetSpentOnDateBase === "function")
      ? window.getBudgetSpentOnDateBase
      : null;

    function add(map, k, v) {
      map[k] = safeNum(map[k] || 0) + safeNum(v || 0);
    }

    function isInternal(t) {
      const cat = String(t?.category || "").toLowerCase();
      return cat.includes("mouvement interne") || cat === "internal" || !!t?.internal;
    }

    function affectsBudget(t) {
      if (t?.out_of_budget) return false;
      if (t?.affects_budget === false) return false;
      if (t?.affects_budget === true) return true;
      // default: true unless explicitly marked out_of_budget/internal
      return true;
    }

    function isPaid(t) {
      // Robust paid flag
      if (t?.paid === true) return true;
      if (t?.is_paid === true) return true;
      if (t?.status) {
        const s = String(t.status).toLowerCase();
        if (s === "paid" || s === "done" || s === "settled") return true;
      }
      // If has paid_at, consider paid
      if (t?.paid_at) return true;
      return false;
    }

    function signedAmountBase(t) {
      // Convention: expenses negative, incomes positive
      const amt = safeNum(t?.amount ?? t?.value ?? 0);
      const cur = String(t?.currency || b).toUpperCase();
      const kind = String(t?.type || t?.kind || "").toLowerCase();
      let sgn = 0;

      if (kind.includes("income") || kind.includes("in") || kind.includes("revenue")) sgn = +1;
      else if (kind.includes("expense") || kind.includes("out") || kind.includes("spend")) sgn = -1;
      else {
        // Heuristic: negative amount = expense already
        sgn = (amt < 0) ? +1 : 1;
      }

      const a = toBase(Math.abs(amt), cur) * sgn;
      // If original is negative and heuristic used, keep sign
      if (!kind && amt < 0) return toBase(amt, cur);
      return a;
    }

    // Iterate txs
    txs.forEach((t) => {
      if (!t) return;

      const d = _parseISODate(t.date || t.at || t.created_at);
      if (!d) return;

      // keep within range
      d.setHours(0, 0, 0, 0);
      if (d < start || d > end) return;

      if (isInternal(t)) return;

      const k = _toISODate(d);
      if (!k) return;

      const net = signedAmountBase(t);

      if (isPaid(t)) {
        add(paidNet, k, net);

        // spent bars: only expenses, only past days, only affects budget (and not out_of_budget/internal)
        if (net < 0) {
          add(paidSpentAll, k, -net);
          if (affectsBudget(t)) add(paidSpentBudget, k, -net);
        }
      } else {
        // pending: expenses to pay (negative net), incomes to receive (positive net)
        if (net < 0) add(pendingNetExp, k, net);
        if (net > 0) add(pendingNetInc, k, net);
      }
    });

    // Build daily points
    const actual = [];
    const forecast = [];
    const spentBars = [];
    const budgetUsedVal = [];

    let bal = safeNum(startBalance);

    _forEachDateInclusive(start, end, (d) => {
      const k = _toISODate(d);
      if (!k) return;

      // Use today boundary: actual until today, forecast after today
      if (tDate && d <= tDate) {
        bal += safeNum(paidNet[k] || 0);
        actual.push({ x: k, y: round2(bal) });
        forecast.push({ x: k, y: (tDate && d.getTime() === tDate.getTime()) ? round2(bal) : null });

        const spent = safeNum(paidSpentAll[k] || 0);
        spentBars.push({ x: k, y: round2(spent) });
        const used = budgetSpentFn ? safeNum(budgetSpentFn(k)) : safeNum(paidSpentBudget[k] || 0);
        budgetUsedVal.push({ x: k, y: round2(used) });
      } else {
        // forecast starts from last actual balance
        bal -= dailyBudget;

        if (includePendingExpenses) bal += safeNum(pendingNetExp[k] || 0);
        if (includePendingIncomes) bal += safeNum(pendingNetInc[k] || 0);

        actual.push({ x: k, y: null });
        forecast.push({ x: k, y: round2(bal) });
        spentBars.push({ x: k, y: null });
        budgetUsedVal.push({ x: k, y: null });
      }
    });

    // thresholds
    const threshold500 = (typeof window.safeFxConvert === "function")
      ? window.safeFxConvert(500, "EUR", b, null)
      : (typeof window.fxConvert === "function" ? window.fxConvert(500, "EUR", b) : null);

    const thr500 = (threshold500 === null || !Number.isFinite(threshold500)) ? null : round2(threshold500);

    // validate: no NaN in series
    const allY = []
      .concat(actual.map(p => p.y), forecast.map(p => p.y), spentBars.map(p => p.y), budgetUsedVal.map(p => p.y))
      .filter(v => v !== null);
    if (allY.some(v => Number.isNaN(v))) return { ok: false, reason: "Séries invalides (NaN)." };

    return {
      ok: true,
      b,
      start,
      end,
      tStr,
      dailyBudget,
      currentBalance,
      startBalance,
      actual,
      forecast,
      spentBars,
      budgetUsedVal,
      thr500,
      segFilter: getKpiScope(),
      segLabel: seg ? segLabel(seg) : "Période complète"
    };
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function renderCashflowChart() {
    // keep in sync with existing navigation
    if (typeof window.activeView !== "undefined" && window.activeView !== "dashboard") return;

    // Load category filter from localStorage (idempotent)
    if (!renderCashflowChart.__catsLoaded) {
      loadExcludedCats();
      renderCashflowChart.__catsLoaded = true;
    }

    const container = document.getElementById("solde-projection-container");
    if (!container) return;

    if (typeof ApexCharts !== "function") {
      container.innerHTML = '<div class="card"><h2>Trésorerie</h2><div class="muted">ApexCharts non chargé.</div></div>';
      return;
    }

    let built = null;
    try {
      built = buildSeries();
    } catch (err) {
      window.__cashflowChart = null;
      container.innerHTML = `
        <div class="card">
          <h2>Trésorerie (réel + prévision)</h2>
          <div class="muted" style="margin-top:6px;">Erreur cashflow: ${escapeHTML(err && err.message ? err.message : String(err))}</div>
        </div>`;
      return;
    }

    if (!built.ok) {
      container.innerHTML = `
        <div class="card">
          <h2>Trésorerie (réel + prévision)</h2>
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
            <div style="margin-top:8px; max-height:180px; overflow:auto; border:1px solid rgba(0,0,0,12); border-radius:12px; padding:10px; background:#fff; min-width:220px;">
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

    const scopeLabel = (getKpiScope() === "period") ? "Toute la période" : "Segment courant";

    container.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap;">
          <div>
            <h2>Trésorerie (réel + prévision)</h2>
            <div class="muted" style="margin-top:4px;">
              Réel jusqu’au <b>${built.tStr}</b>, puis prévision = réel − budget/jour + (impayés / à recevoir).
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

        <div id="cashflowChart" style="margin-top:12px;">
          <div id="cashflowCurve" style="min-height:335px;"></div>
        </div>

        <div class="muted" style="margin-top:10px; display:flex; gap:12px; flex-wrap:wrap;">
          <span>Plage: <b>${escapeHTML(built.segLabel || "—")}</b></span>
          <span>Devise: <b>${built.b}</b></span>
          <span>Budget/jour: <b>${round2(built.dailyBudget)} ${built.b}</b></span>
          <span>Solde actuel (wallets): <b>${round2(built.currentBalance)} ${built.b}</b></span>
        </div>
      </div>
    `;

    // Ensure regression wrapper exists (and keep it stable even if another renderer injects only cashflowCurve)
    ensureCashflowChartAlias();

    const series = [
      { name: `Trésorerie réel (${built.b})`, data: built.actual, type: "line" },
      { name: `Prévision (${built.b})`, data: built.forecast, type: "line" },
      { name: `Dépensé/jour (${built.b})`, data: built.spentBars, type: "column" },
      { name: `Budget dépensé/jour (${built.b})`, data: built.budgetUsedVal, type: "column" }
    ];

    const options = {
      chart: {
        height: 320,
        type: "line",
        stacked: false,
        zoom: { enabled: true, type: "x", autoScaleYaxis: false },
        toolbar: { show: true },
        animations: { enabled: true },
      },
      series,
      stroke: { width: [3, 3, 0, 0], curve: "smooth" },
      dataLabels: { enabled: false },
      markers: { size: 0 },
      xaxis: { type: "datetime" },
      legend: { position: "bottom" }
    };

    const el = document.querySelector("#cashflowCurve");
    if (!el) return;

    try { if (chart) chart.destroy(); } catch (_) { }
    chart = new ApexCharts(el, options);
    await chart.render();
    window.__cashflowChart = chart; // debug contract

    const btn = document.getElementById("cf-reset-zoom");
    if (btn) btn.onclick = () => { try { chart.resetZoom(); } catch (_) { } };

    const cbExp = document.getElementById("cf-pending-exp");
    if (cbExp) cbExp.onchange = (e) => {
      includePendingExpenses = !!e.target.checked;
      try { localStorage.setItem("cashflow_include_pending_exp_v1", includePendingExpenses ? "1" : "0"); } catch (_) { }
      queueRenderCashflow();
    };

    const cbInc = document.getElementById("cf-pending-inc");
    if (cbInc) cbInc.onchange = (e) => {
      includePendingIncomes = !!e.target.checked;
      try { localStorage.setItem("cashflow_include_pending_inc_v1", includePendingIncomes ? "1" : "0"); } catch (_) { }
      queueRenderCashflow();
    };

    const catCbs = container.querySelectorAll(".cashflowCatCb");
    catCbs.forEach((cb) => {
      cb.onchange = () => {
        let cat = cb.getAttribute("data-cat") || "";
        try { cat = decodeURIComponent(cat); } catch (_) { }
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

  window.renderCashflowChart = renderCashflowChart;

  function hook(name) {
    const fn = window[name];
    if (typeof fn !== "function") return false;
    if (fn.__cashflowHooked) return;
    const wrapped = async function (...args) {
      const out = await fn.apply(this, args);
      try { queueRenderCashflow(); } catch (_) { }
      return out;
    };
    wrapped.__cashflowHooked = true;
    window[name] = wrapped;
    return true;
  }

  hook("redrawCharts");
  hook("refreshAll");
  hook("refreshDashboard");
  hook("dataUpdated");

  window.addEventListener("tb:data-updated", () => { try { queueRenderCashflow(); } catch (_) { } });
  window.addEventListener("tb:dashboard-opened", () => { try { queueRenderCashflow(); } catch (_) { } });

  queueRenderCashflow();

})();