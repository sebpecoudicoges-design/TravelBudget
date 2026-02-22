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

  // Defer render to avoid re-rendering while toggle click is still bubbling
  let _renderScheduled = false;
  function queueRenderCashflow() {
    if (_renderScheduled) return;
    _renderScheduled = true;
    setTimeout(() => {
      _renderScheduled = false;
      try { renderCashflowChart(); } catch (_) {}
    }, 0);
  }

  function base() {
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

  function sumWalletsBase() {
    const b = base();
    if (!b) return 0;
    let total = 0;
    for (const w of (window.state?.wallets || [])) {
      total += toBase(w?.balance || 0, w?.currency || b);
    }
    return round2(total);
  }

  function txDateRange(tx) {
    const ds = tx?.dateStart || tx?.date_start;
    const de = tx?.dateEnd || tx?.date_end || ds;
    const s = (window.parseISODateOrNull ? window.parseISODateOrNull(ds) : _parseISODate(ds));
    const e = (window.parseISODateOrNull ? window.parseISODateOrNull(de) : _parseISODate(de));
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

  function buildMaps(periodStart, periodEnd) {
    const paidNet = {};              // all paid net (income-expense)
    const paidSpentAll = {};         // paid expense only (positive), ALL expenses (for "Dépensé/jour")
    const paidSpentBudget = {};      // paid expense only (positive), affects budget and not out_of_budget (for "Budget dépensé/jour")
    const pendingNetExp = {};        // pending expense only (negative already)
    const pendingNetInc = {};        // pending income only (positive)

    const txs = window.state?.transactions || [];
    const b = base();

    for (const t of txs) {
      if (!t) continue;
      if (t.isInternal) continue;

      const cat = (t.category !== undefined && t.category !== null) ? String(t.category) : "";
      const catExcluded = cat && excludedCats.has(cat);

      const rng = txDateRange(t);
      if (!rng) continue;

      // clamp to period
      const s = (rng.start < periodStart) ? periodStart : rng.start;
      const e = (rng.end > periodEnd) ? periodEnd : rng.end;
      if (e < periodStart || s > periodEnd) continue;

      const isPaid = (t.payNow === undefined) ? true : !!t.payNow;

      const amtBase = toBase(t.amount || 0, t.currency || b);
      if (!Number.isFinite(amtBase)) continue;

      const type = String(t.type || "").toLowerCase();
      if (type !== "expense" && type !== "income") continue;

      const signed = (type === "income") ? +amtBase : -amtBase;

      if (isPaid) {
        addDistributed(paidNet, s, e, signed);

        if (type === "expense") {
          // all paid expenses (total spent per day)
          if (!catExcluded) addDistributed(paidSpentAll, s, e, +amtBase);

          // budget spent per day: only expenses that affect budget and are not out_of_budget
          const affectsBudget = (t.affectsBudget === undefined) ? true : !!t.affectsBudget;
          const outOfBudget = !!t.outOfBudget || !!t.out_of_budget;
          if (!catExcluded && affectsBudget && !outOfBudget) addDistributed(paidSpentBudget, s, e, +amtBase);
        }
      } else {
        // pending only impacts forecast if toggles enabled
        if (type === "expense") addDistributed(pendingNetExp, s, e, -amtBase);
        else addDistributed(pendingNetInc, s, e, +amtBase);
      }
    }

    return { paidNet, paidSpentAll, paidSpentBudget, pendingNetExp, pendingNetInc };
  }

  function buildSeries() {
    const period = window.state?.period;
    if (!period?.start || !period?.end) return { ok:false, reason:"Aucune période définie." };

    const start = window.parseISODateOrNull?.(period.start);
    const end = window.parseISODateOrNull?.(period.end);
    if (!start || !end) return { ok:false, reason:"Dates de période invalides." };

    const b = base();
    if (!b) return { ok:false, reason:"Devise de base manquante." };

    const tStr = todayStr();
    const tDate = window.parseISODateOrNull?.(tStr);

    const dailyBudget = safeNum(period.dailyBudgetBase || period.daily_budget_base || 0);

    const currentBalance = sumWalletsBase();

    const { paidNet, paidSpentAll, paidSpentBudget, pendingNetExp, pendingNetInc } = buildMaps(start, end);

    // compute cum net paid from start..today => estimate starting balance
    let cumToToday = 0;
    (window.forEachDateInclusive ? window.forEachDateInclusive : _forEachDateInclusive)(start, end, (d) => {
      const k = (window.toLocalISODate ? window.toLocalISODate(d) : _toISODate(d));
      if (tDate && d <= tDate) cumToToday += safeNum(paidNet[k] || 0);
    });

    const startBalance = round2(currentBalance - cumToToday);

    const actual = [];
    const forecast = [];
    const spentBars = [];
    const budgetUsedVal = [];

    let bal = startBalance;

    (window.forEachDateInclusive ? window.forEachDateInclusive : _forEachDateInclusive)(start, end, (d) => {
      const k = (window.toLocalISODate ? window.toLocalISODate(d) : _toISODate(d));

      if (tDate && d <= tDate) {
        bal += safeNum(paidNet[k] || 0);
        actual.push({ x: k, y: round2(bal) });
        forecast.push({ x: k, y: (tDate && d.getTime() === tDate.getTime()) ? round2(bal) : null });

        const spent = safeNum(paidSpentAll[k] || 0);
        spentBars.push({ x: k, y: round2(spent) });
        const used = safeNum(paidSpentBudget[k] || 0);
        budgetUsedVal.push({ x: k, y: round2(used) });
      } else {
        // forecast starts from last actual balance
        bal -= dailyBudget;

        if (includePendingExpenses) bal += safeNum(pendingNetExp[k] || 0);
        if (includePendingIncomes)  bal += safeNum(pendingNetInc[k] || 0);

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
    if (allY.some(v => Number.isNaN(v))) return { ok:false, reason:"Séries invalides (NaN)." };

    return { ok:true, b, start, end, tStr, dailyBudget, currentBalance, startBalance, actual, forecast, spentBars, budgetUsedVal, thr500 };
  }

  function renderCashflowChart() {
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

    // UI
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
          <span>Devise: <b>${built.b}</b></span>
          <span>Budget/jour: <b>${round2(built.dailyBudget)} ${built.b}</b></span>
          <span>Solde actuel (wallets): <b>${round2(built.currentBalance)} ${built.b}</b></span>
        </div>
      </div>
    `;

    const series = [
      { name: `Trésorerie réel (${built.b})`, data: built.actual, type: "line" },
      { name: `Prévision (${built.b})`, data: built.forecast, type: "line" },
      { name: `Dépensé/jour (${built.b})`, data: built.spentBars, type: "column" },
      { name: `Budget dépensé/jour (${built.b})`, data: built.budgetUsedVal, type: "column" }
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
            return `${round2(v)} ${built.b}`;
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
            label: { text: "500€", style: { background: "#ef4444" } }
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

    try {
      if (chart) chart.destroy();
    } catch (_) {}

    chart = new ApexCharts(el, options);
    chart.render();
    window.__cashflowChart = chart;

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
    // First render attempt quickly, then retry once (covers late state hydration).
    setTimeout(queueRenderCashflow, 150);
    setTimeout(queueRenderCashflow, 900);
  }

  // IMPORTANT: legacy scripts are injected dynamically by /src/main.js.
  // If we register DOMContentLoaded after it already fired, it will never run.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _runCashflowInit);
  } else {
    _runCashflowInit();
  }
})();
