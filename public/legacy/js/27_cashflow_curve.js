/* =========================
   Cashflow Curve (Unified Scope)
   ========================= */

function _cashflowResolveHorizon(scope, todayISO) {
  let startISO = state?.period?.start;
  let endISO   = state?.period?.end;

  try {
    if (String(scope || "segment").toLowerCase() !== "period" &&
        typeof getBudgetSegmentForDate === "function") {

      const seg = getBudgetSegmentForDate(todayISO);
      if (seg) {
        if (seg.start || seg.start_date)
          startISO = String(seg.start || seg.start_date);

        if (seg.end || seg.end_date)
          endISO = String(seg.end || seg.end_date);
      }
    }
  } catch (_) {}

  return { startISO, endISO };
}

function renderCashflowChart() {

  const container = document.getElementById("cashflowChart");
  if (!container) return;

  const todayISO = (typeof window.getDisplayDateISO === "function")
    ? window.getDisplayDateISO()
    : toLocalISODate(new Date());

  const scope = localStorage.getItem("travelbudget_kpi_projection_scope_v1") || "segment";
  const { startISO, endISO } = _cashflowResolveHorizon(scope, todayISO);

  const start = parseISODateOrNull(startISO);
  const end   = parseISODateOrNull(endISO);
  if (!start || !end) return;

  const points = [];
  let runningEUR = 0;

  forEachDateInclusive(start, end, (d) => {
    const ds = toLocalISODate(d);

    // Wallet total (pivot EUR)
    let totalEUR = 0;
    for (const w of (state.wallets || [])) {
      const bal = Number(w.balance) || 0;
      if (typeof window.amountToDisplayForDate === "function") {
        totalEUR += window.amountToDisplayForDate(bal, w.currency || "EUR", ds);
      } else {
        totalEUR += bal;
      }
    }

    runningEUR = totalEUR;
    points.push({ x: ds, y: runningEUR });
  });

  if (!points.length) return;

  container.innerHTML = `
    <div style="height:280px;">
      <canvas id="cashflowCanvas"></canvas>
    </div>
  `;

  const ctx = document.getElementById("cashflowCanvas").getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map(p => p.x),
      datasets: [{
        label: "Trésorerie",
        data: points.map(p => p.y),
        borderWidth: 2,
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8 }
        },
        y: {
          beginAtZero: false
        }
      }
    }
  });
}