/* =========================
   Main render
   ========================= */

function _tbDebugRenderEnabled() {
  try { return !!window.__tbDebugRender; } catch (_) { return false; }
}

function _tbRenderLog() {
  try {
    if (!_tbDebugRenderEnabled()) return;
    const args = Array.from(arguments);
    args.unshift("[TB]");
    console.log.apply(console, args);
  } catch (_) {}
}


window.tbRefreshFinancialState = function tbRefreshFinancialState(reason, opts) {
  const options = opts || {};
  try {
    if (typeof renderWallets === "function") renderWallets();
  } catch (_) {}
  try {
    if (typeof renderKPI === "function") renderKPI();
  } catch (_) {}
  try {
    const view = (typeof activeView === "string" && activeView) ? activeView : "dashboard";
    if (options.cashflow !== false && view === "dashboard" && typeof tbRequestCashflowCurveRender === "function") {
      tbRequestCashflowCurveRender(reason || "financialState");
    }
  } catch (_) {}
};

// Centralised main render entry point.
// Goal: a single broken widget must not take down the whole page.
function renderAll() {
  _tbRenderLog("renderAll", { view: (typeof activeView === "string" && activeView) ? activeView : "dashboard" });
  const view = (typeof activeView === "string" && activeView) ? activeView : "dashboard";

  // If safeCall isn't loaded for some reason, fall back to best-effort legacy behaviour.
  if (typeof safeCall !== "function") {
    if (view === "dashboard") {
      try { if (typeof renderWallets === "function") renderWallets(); } catch (e) { console.warn("[renderAll] renderWallets failed", e); }
      try { if (typeof renderDailyBudget === "function") renderDailyBudget(); } catch (e) { console.warn("[renderAll] renderDailyBudget failed", e); }
      try { if (typeof renderKPI === "function") renderKPI(); } catch (e) { console.warn("[renderAll] renderKPI failed", e); }
      try { if (typeof tbRequestCashflowCurveRender === "function") tbRequestCashflowCurveRender("renderAll"); else if (typeof renderCashflowCurve === "function") renderCashflowCurve(); } catch (e) { console.warn("[renderAll] renderCashflowCurve failed", e); }
      try { if (typeof renderCharts === "function") renderCharts(); } catch (e) { console.warn("[renderAll] renderCharts failed", e); }
      try { if (typeof tbRequestRedrawCharts === "function") tbRequestRedrawCharts("renderAll");
      else if (typeof redrawCharts === "function") redrawCharts(); } catch (e) { console.warn("[renderAll] redrawCharts failed", e); }
      return;
    }

    if (view === "transactions") {
      try { if (typeof renderTransactions === "function") renderTransactions(); } catch (e) { console.warn("[renderAll] renderTransactions failed", e); }
      return;
    }

    if (view === "settings") {
      try { if (typeof renderSettings === "function") renderSettings(); } catch (e) { console.warn("[renderAll] renderSettings failed", e); }
      return;
    }

    // other views (trip/members/help): their render is triggered by showView()
    return;
  }

  // Safe renders (each section isolated)
  if (view === "dashboard") {
  safeCall("Wallets", () => {
    if (typeof renderWallets === "function") return renderWallets();
  }, { containerId: "wallets-container" });

  safeCall("Budget journalier", () => {
    if (typeof renderDailyBudget === "function") return renderDailyBudget();
  }, { containerId: "daily-budget-container" });

  safeCall("Dashboard KPIs", () => {
    if (typeof renderKPI === "function") return renderKPI();
  }, { containerId: "kpi" });

  // V8.9: defer non-critical heavy blocks after first useful render
  setTimeout(() => {
    try {
      if ((typeof activeView === "string" ? activeView : "dashboard") !== "dashboard") return;

      safeCall("Cashflow curve", () => {
        if (typeof tbRequestCashflowCurveRender === "function") return tbRequestCashflowCurveRender("renderAll:deferred");
        if (typeof renderCashflowCurve === "function") return renderCashflowCurve();
      }, { containerId: "view-dashboard" });

      safeCall("Charts", () => {
        if (typeof renderCharts === "function") return renderCharts();
      }, { containerId: "view-dashboard" });

      safeCall("Redraw charts", () => {
        if (typeof tbRequestRedrawCharts === "function") return tbRequestRedrawCharts("renderAll:deferred");
        if (typeof redrawCharts === "function") return redrawCharts();
      }, { containerId: "view-dashboard" });
    } catch (e) {
      console.warn("[renderAll] deferred dashboard blocks failed", e);
    }
  }, 0);

  return;
}

  if (view === "transactions") {
    safeCall("Transactions", () => { if (typeof renderTransactions === "function") return renderTransactions(); }, { containerId: "view-transactions" });
    return;
  }

  if (view === "settings") {
    safeCall("Settings", () => { if (typeof renderSettings === "function") return renderSettings(); }, { containerId: "view-settings" });
    return;
  }

  if (view === "analysis") {
    safeCall("Analyse budget", () => { if (typeof renderBudgetAnalysis === "function") return renderBudgetAnalysis(); }, { containerId: "view-analysis" });
    return;
  }

  // other views (trip/members/help): their render is triggered by showView()
}