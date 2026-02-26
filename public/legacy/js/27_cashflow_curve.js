/* =========================
   Cashflow Curve (Full Projection Engine)
   ========================= */

function renderCashflowChart() {

  const el = document.getElementById("cashflowChart");
  if (!el) return;

  const todayISO = (typeof window.getDisplayDateISO === "function")
    ? window.getDisplayDateISO()
    : toLocalISODate(new Date());

  const includeUnpaid =
    localStorage.getItem("travelbudget_kpi_projection_include_unpaid_v1") === "1";

  const scope =
    localStorage.getItem("travelbudget_kpi_projection_scope_v1") || "segment";

  // ---- Horizon resolve (same as KPI)
  let horizonStartISO = state?.period?.start;
  let horizonEndISO   = state?.period?.end;

  try {
    if (scope !== "period" && typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(todayISO);
      if (seg) {
        if (seg.start || seg.start_date)
          horizonStartISO = String(seg.start || seg.start_date);
        if (seg.end || seg.end_date)
          horizonEndISO = String(seg.end || seg.end_date);
      }
    }
  } catch (_) {}

  const start = parseISODateOrNull(horizonStartISO);
  const end   = parseISODateOrNull(horizonEndISO);
  if (!start || !end) return;

  const labels = [];
  const data = [];

  let runningEUR = 0;

  forEachDateInclusive(start, end, (d) => {

    const ds = toLocalISODate(d);

    // ---- Wallet total
    let totalEUR = 0;
    for (const w of (state.wallets || [])) {
      const bal = Number(w.balance) || 0;
      if (typeof window.amountToDisplayForDate === "function") {
        totalEUR += window.amountToDisplayForDate(bal, w.currency || "EUR", ds);
      } else {
        totalEUR += bal;
      }
    }

    // ---- Forecast daily budget
    let forecastEUR = 0;

    let daily = Number(state?.period?.dailyBudgetBase || 0);
    let cur   = String(state?.period?.baseCurrency || "EUR").toUpperCase();

    try {
      if (typeof getBudgetSegmentForDate === "function") {
        const seg = getBudgetSegmentForDate(ds);
        if (seg) {
          const segDaily = Number(seg.dailyBudgetBase ?? seg.daily_budget_base);
          const segCur   = String(seg.baseCurrency || seg.base_currency || cur);
          if (Number.isFinite(segDaily)) daily = segDaily;
          if (segCur) cur = segCur.toUpperCase();
        }
      }
    } catch (_) {}

    if (typeof window.amountToDisplayForDate === "function") {
      forecastEUR = window.amountToDisplayForDate(daily, cur, ds);
    } else {
      forecastEUR = daily;
    }

    // ---- Unpaid
    let pendingEUR = 0;
    if (includeUnpaid) {
      pendingEUR = Number(netPendingEUR(ds, ds)) || 0;
    }

    runningEUR = totalEUR + pendingEUR - forecastEUR;

    labels.push(ds);
    data.push(runningEUR);
  });

  el.innerHTML = `<canvas id="cashflowCanvas" height="260"></canvas>`;
  const ctx = document.getElementById("cashflowCanvas").getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data,
        borderWidth: 2,
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { beginAtZero: false }
      }
    }
  });
}