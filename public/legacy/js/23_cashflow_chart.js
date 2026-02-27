/* =========================
   Cashflow (past actual + future forecast) - ApexCharts
   ========================= */

(function () {
  let _cashChart = null;

  function _sumWalletsInBase() {
    const base = state.period.baseCurrency;
    let total = 0;
    for (const w of (state.wallets || [])) {
      const eff =
        (typeof window.tbGetWalletEffectiveBalance === "function")
          ? window.tbGetWalletEffectiveBalance(w.id)
          : (w.balance || 0);
      total += amountToBase(eff || 0, w.currency || base);
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
        // Forecast: assume we spend the daily budget
        const daily = Number(state.period.dailyBudgetBase || 0);
        bal -= daily;
      }

      points.push({ x: ds, y: round2(bal) });
    });

    return points;
  }

  function renderCashflowChart() {
    const el = document.getElementById("cashflowChart");
    if (!el) return;

    const seriesPoints = _buildCashflowSeries();
    if (!seriesPoints || !seriesPoints.length) {
      el.innerHTML = `<div class="muted">Courbe indisponible (période invalide)</div>`;
      return;
    }

    const base = state.period.baseCurrency;

    const options = {
      chart: {
        type: "area",
        height: 260,
        toolbar: { show: false },
        animations: { enabled: true }
      },
      series: [
        { name: "Solde", data: seriesPoints.map(p => [p.x, p.y]) }
      ],
      xaxis: {
        type: "category",
        labels: { rotate: -45 }
      },
      yaxis: {
        labels: {
          formatter: (v) => `${Number(v || 0).toFixed(0)} ${base}`
        }
      },
      tooltip: {
        x: { show: true },
        y: { formatter: (v) => `${Number(v || 0).toFixed(2)} ${base}` }
      },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 2 },
      fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } }
    };

    try {
      if (_cashChart) _cashChart.destroy();
    } catch (_) {}

    _cashChart = new ApexCharts(el, options);
    _cashChart.render();
  }

  // Expose globally
  window.renderCashflowChart = renderCashflowChart;
})();