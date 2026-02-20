(function () {

  let chart = null;
  let simulatedDaily = null;
  let includePending = (localStorage.getItem('cashflow_include_pending_v1') ?? '1') === '1';

  function base() {
    return window.state?.period?.baseCurrency;
  }

  function todayStr() {
    return window.toLocalISODate?.(new Date());
  }

  function round2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  function sumWalletsBase() {
    const b = base();
    if (!b) return 0;

    let total = 0;
    const ws = window.state?.wallets || [];

    for (const w of ws) {
      const bal = Number(w.balance) || 0;
      const cur = w.currency || b;

      if (typeof window.amountToBase === "function") {
        total += window.amountToBase(bal, cur);
      } else if (typeof window.fxConvert === "function") {
        const v = window.fxConvert(bal, cur, b);
        if (v !== null) total += v;
      } else if (cur === b) {
        total += bal;
      }
    }

    return total;
  }

  
  function txDateStr(tx) {
    // Robust date extraction for charts.
    // Priority:
    // 1) tx.date (epoch ms)
    // 2) tx.dateStart (YYYY-MM-DD)
    // 3) tx.createdAt (epoch ms)
    const v = tx?.date;
    if (v) {
      try {
        const d = new Date(Number(v));
        if (!isNaN(d.getTime())) return window.toLocalISODate(d);
      } catch (_) {}
    }
    const ds = tx?.dateStart;
    if (ds) {
      try {
        const d = new Date(String(ds) + "T00:00:00");
        if (!isNaN(d.getTime())) return window.toLocalISODate(d);
      } catch (_) {}
    }
    const ca = tx?.createdAt;
    if (ca) {
      try {
        const d = new Date(Number(ca));
        if (!isNaN(d.getTime())) return window.toLocalISODate(d);
      } catch (_) {}
    }
    return null;
  }

  function pendingNetBaseByDateStr() {
    const b = base();
    if (!b) return {};
    const out = {};
    const txs = window.state?.transactions || [];
    for (const t of txs) {
      if (!t) continue;
      if (t.isInternal) continue;
      // pending only
      if (t.payNow !== false) continue;

      const ds = txDateStr(t);
      if (!ds) continue;

      const amt = Number(t.amount) || 0;
      const cur = t.currency || b;
      let amtBase = null;

      if (typeof window.amountToBase === "function") {
        amtBase = window.amountToBase(amt, cur);
      } else if (typeof window.fxConvert === "function") {
        amtBase = window.fxConvert(amt, cur, b);
      } else if (cur === b) {
        amtBase = amt;
      }

      if (amtBase === null || !isFinite(amtBase)) continue;

      // income increases, expense decreases
      const signed = (t.type === "income") ? amtBase : -amtBase;

      out[ds] = (out[ds] || 0) + signed;
    }
    return out;
  }

  function buildSeries() {

const period = window.state?.period;
    if (!period?.start || !period?.end) return null;

    const start = window.parseISODateOrNull(period.start);
    const end = window.parseISODateOrNull(period.end);
    if (!start || !end) return null;

    const today = todayStr();
    const todayDate = window.parseISODateOrNull(today);

    const realDaily = Number(period.dailyBudgetBase || 0);
    const daily = simulatedDaily !== null ? simulatedDaily : realDaily;

    const currentBalance = sumWalletsBase();

    const actual = [];
    const forecast = [];

    const pendingMap = pendingNetBaseByDateStr();

    let bal = currentBalance;
    let zeroDate = null;
    let daysToZero = null;
    let futureIndex = 0;

    window.forEachDateInclusive(start, end, (d) => {

      const ds = window.toLocalISODate(d);

      if (todayDate && d <= todayDate) {
        actual.push({ x: ds, y: round2(currentBalance) });
        forecast.push({ x: ds, y: null });
      } else {
        futureIndex += 1;
        bal -= daily;
        if (includePending) {
          const net = pendingMap[ds] || 0;
          bal += net;
        }

        actual.push({ x: ds, y: null });
        forecast.push({ x: ds, y: round2(bal) });

        if (daysToZero === null && bal <= 0) {
          zeroDate = ds;
          daysToZero = futureIndex;
        }
      }
    });

    let eur250Base = null;
    try {
      if (typeof window.fxConvert === "function") {
        eur250Base = window.fxConvert(250, "EUR", base());
      } else if (typeof window.amountToBase === "function") {
        eur250Base = window.amountToBase(250, "EUR");
      }
      if (!isFinite(eur250Base)) eur250Base = null;
    } catch (_) {}

    return {
      actual,
      forecast,
      zeroDate,
      eur250Base,
      realDaily,
      currentBalance,
      daysToZero
    };
  }

  function render() {

    const container = document.getElementById("solde-projection-container");
    if (!container) return;
    if (typeof ApexCharts !== "function") return;

    const built = buildSeries();
    if (!built) return;

    const sliderMax = Math.max(10, Math.round((built.realDaily || 0) * 2) || 1000);
    const sliderVal = Math.round(simulatedDaily ?? built.realDaily ?? 0);

    // Impact (simple)
    let impact = "—";
    if (built.daysToZero !== null) {
      impact = `-${built.daysToZero} j`;
    }

    container.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between;">
          <h2 style="margin:0;">Trésorerie</h2>
          <button class="btn" id="resetZoom">Reset</button>
        </div>

        <div id="cashflowCurve" style="margin-top:12px;"></div>

        <div style="margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div class="muted" style="font-size:12px;">Simulation</div>
            <label class="muted" style="display:flex; gap:8px; align-items:center; font-size:12px; cursor:pointer;">
              <input type="checkbox" id="includePending" ${includePending ? 'checked' : ''} />
              Inclure à recevoir/à payer
            </label>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:6px;">
            <span>Budget / jour</span>
            <strong id="budgetVal">${sliderVal} ${base()}</strong>
          </div>

          <input
            id="budgetSlider"
            type="range"
            min="0"
            max="${sliderMax}"
            step="1"
            value="${sliderVal}"
            style="width:100%; margin-top:8px;"
          />

          <div style="display:flex; justify-content:space-between; margin-top:6px;">
            <span class="muted">Impact</span>
            <strong>${impact}</strong>
          </div>
        </div>
      </div>
    `;

    const options = {
      chart: { type: "line", height: 320 },
      series: [
        { name: "Réel", data: built.actual },
        { name: "Prévision", data: built.forecast }
      ],
      stroke: { width: [3, 3], dashArray: [0, 6], curve: "smooth" },
      markers: { size: 0 },
      annotations: {
        yaxis: [
          { y: 0, borderColor: "#ef4444", label: { text: "Seuil 0" } },
          built.eur250Base !== null
            ? { y: built.eur250Base, borderColor: "#f59e0b", label: { text: "Seuil 250€" } }
            : null
        ].filter(Boolean)
      }
    };

    if (chart) chart.destroy();
    chart = new ApexCharts(document.querySelector("#cashflowCurve"), options);
    chart.render();

    document.getElementById("resetZoom").onclick = () => {
      try { chart.resetZoom(); } catch (_) {}
    };

    
    const pendingCb = document.getElementById("includePending");
    if (pendingCb) {
      pendingCb.onchange = (e) => {
        includePending = !!e.target.checked;
        try { localStorage.setItem('cashflow_include_pending_v1', includePending ? '1' : '0'); } catch (_) {}
        render();
      };
    }

    const slider = document.getElementById("budgetSlider");
    const valEl = document.getElementById("budgetVal");

    slider.oninput = (e) => {
      simulatedDaily = Number(e.target.value);
      valEl.textContent = `${simulatedDaily} ${base()}`;
      render();
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(render, 300);
  });

})();