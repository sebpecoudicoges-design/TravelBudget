/* =========================
   Cashflow (past actual + future forecast) - ApexCharts
   ========================= */

(function () {
  let _cashChart = null;

  function _sumWalletsInBase() {
    const base = state.period.baseCurrency;
    let total = 0;
    for (const w of (state.wallets || [])) {
      total += amountToBase(w.balance || 0, w.currency || base);
    }
    return total;
  }

  function _netPaidBaseByDate() {
    // net = income - expense, only "paid" impacts cash
    const map = new Map();

    for (const tx of (state.transactions || [])) {
      const d = tx.dateStart;
      if (!d) continue;
      if (!periodContains(d)) continue;

      const isPaid = (tx.payNow === undefined) ? true : !!tx.payNow;
      if (!isPaid) continue;

      const amtBase = amountToBase(tx.amount || 0, tx.currency || state.period.baseCurrency);

      let delta = 0;
      if (tx.type === "expense") delta = -amtBase;
      else if (tx.type === "income") delta = +amtBase;
      else continue;

      map.set(d, (map.get(d) || 0) + delta);
    }

    return map;
  }

  function _buildCashflowSeries() {
    const start = parseISODateOrNull(state.period.start);
    const end = parseISODateOrNull(state.period.end);
    if (!start || !end) return null;

    const todayStr = toLocalISODate(new Date());
    const today = parseISODateOrNull(todayStr);

    const netMap = _netPaidBaseByDate();

    // Estimate balance at period start:
    // currentWalletsBase = startBalance + sum(netPaid from start..today)
    // => startBalance = currentWalletsBase - cumNetPaidToToday
    let cumToToday = 0;
    forEachDateInclusive(start, end, (d) => {
      const ds = toLocalISODate(d);
      if (today && d <= today) cumToToday += (netMap.get(ds) || 0);
    });

    const currentWalletsBase = _sumWalletsInBase();
    const startBalance = currentWalletsBase - cumToToday;

    const points = [];
    let bal = startBalance;

    forEachDateInclusive(start, end, (d) => {
      const ds = toLocalISODate(d);

      if (today && d <= today) {
        // Actual: apply paid net changes of the day
        bal += (netMap.get(ds) || 0);
      } else {
        // Forecast: assume we spend the daily budget (base) each day
        // (simple & readable; we can refine later with allocations/commitments)
        bal += -(state.period.dailyBudgetBase || 0);
      }

      points.push({ x: ds, y: Math.round(bal * 100) / 100 });
    });

    // Threshold 500 EUR converted to base
    const thresholdBase = amountToBase(500, "EUR");
    const thresholdSeries = points.map(p => ({ x: p.x, y: Math.round(thresholdBase * 100) / 100 }));

    return { points, thresholdSeries, todayStr };
  }

  function renderCashflowChart() {
    if (activeView !== "dashboard") return;

    const container = document.getElementById("solde-projection-container");
    if (!container) return;

    const built = _buildCashflowSeries();
    if (!built) {
      container.innerHTML = "";
      return;
    }

    // Build card once
    container.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap;">
          <div>
            <h2>Trésorerie (réel + prévision)</h2>
            <div class="muted" style="margin-top:4px;">
              Réel jusqu’à aujourd’hui, puis prévision basée sur budget/jour. Seuil affiché : 500 €.
            </div>
          </div>
          <button class="btn" id="btn-cashflow-reset">Reset zoom</button>
        </div>
        <div id="cashflowChart" style="margin-top:12px;"></div>
      </div>
    `;

    const base = state.period.baseCurrency;

    const options = {
      chart: {
        type: "line",
        height: 320,
        toolbar: { show: false },
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
        animations: { enabled: true },
      },
      series: [
        { name: `Trésorerie (${base})`, data: built.points },
        { name: "Seuil 500€", data: built.thresholdSeries },
      ],
      stroke: {
        width: [3, 2],
        curve: "smooth",
        dashArray: [0, 6],
      },
      markers: { size: 0 },
      dataLabels: { enabled: false },
      xaxis: {
        type: "category",
        labels: { rotate: -45 },
      },
      yaxis: {
        labels: {
          formatter: (v) => `${Math.round(v)}`,
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v) => `${(Math.round(v * 100) / 100)} ${base}`,
        },
      },
      grid: {
        borderColor: cssVar("--gridline", "rgba(0,0,0,0.1)"),
      },
      annotations: {
        xaxis: [
          {
            x: built.todayStr,
            borderColor: cssVar("--warn", "#f59e0b"),
            label: {
              text: "Aujourd’hui",
              style: { background: cssVar("--warn", "#f59e0b") },
            },
          },
        ],
      },
      theme: { mode: document.body.classList.contains("theme-dark") ? "dark" : "light" },
    };

    // (Re)create chart
    const el = document.querySelector("#cashflowChart");
    if (!el) return;

    if (_cashChart) {
      try { _cashChart.destroy(); } catch (_) {}
      _cashChart = null;
    }

    _cashChart = new ApexCharts(el, options);
    _cashChart.render();

    const btn = document.getElementById("btn-cashflow-reset");
    if (btn) btn.onclick = () => _cashChart && _cashChart.resetSeries && _cashChart.resetSeries();
  }

  // Hook: extend redrawCharts (called by renderAll)
  function hookRedrawCharts() {
    if (!window.redrawCharts) return;
    const original = window.redrawCharts;
    window.redrawCharts = function () {
      original();
      renderCashflowChart();
    };
  }

  // Hook: theme changes might need redraw; safest is to rerender on refreshAll too
  function hookRefreshAll() {
    if (!window.refreshAll) return;
    const original = window.refreshAll;
    window.refreshAll = async function () {
      await original();
      renderCashflowChart();
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    hookRedrawCharts();
    hookRefreshAll();
    setTimeout(renderCashflowChart, 700);
  });
})();
