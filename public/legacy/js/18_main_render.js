/* =========================
   Main render
   ========================= */

// Centralised main render entry point.
// Goal: a single broken widget must not take down the whole page.
function renderAll() {
  // If safeCall isn't loaded for some reason, fall back to best-effort legacy behaviour.
  if (typeof safeCall !== "function") {
    try { if (typeof renderWallets === "function") renderWallets(); } catch (e) { console.warn("[renderAll] renderWallets failed", e); }
    try { if (typeof renderDailyBudget === "function") renderDailyBudget(); } catch (e) { console.warn("[renderAll] renderDailyBudget failed", e); }
    try { if (typeof renderKPI === "function") renderKPI(); } catch (e) { console.warn("[renderAll] renderKPI failed", e); }
    try { if (typeof tbRequestCashflowCurveRender === "function") tbRequestCashflowCurveRender("renderAll"); else if (typeof tbRequestCashflowCurveRender === "function") tbRequestCashflowCurveRender("renderAll"); else if (typeof renderCashflowCurve === "function") renderCashflowCurve(); } catch (e) { console.warn("[renderAll] renderCashflowCurve failed", e); }
    try { if (typeof renderCharts === "function") renderCharts(); } catch (e) { console.warn("[renderAll] renderCharts failed", e); }
    try { if (typeof renderTransactions === "function") renderTransactions(); } catch (e) { console.warn("[renderAll] renderTransactions failed", e); }
    try { if (typeof renderSettings === "function") renderSettings(); } catch (e) { console.warn("[renderAll] renderSettings failed", e); }
    try { if (typeof tbRequestRedrawCharts === "function") tbRequestRedrawCharts("renderAll");
    else if (typeof redrawCharts === "function") redrawCharts(); } catch (e) { console.warn("[renderAll] redrawCharts failed", e); }
    return;
  }

  // Safe renders (each section isolated)
  safeCall("Wallets", () => { if (typeof renderWallets === "function") return renderWallets(); }, { containerId: "wallets-container" });
  safeCall("Budget journalier", () => { if (typeof renderDailyBudget === "function") return renderDailyBudget(); }, { containerId: "daily-budget-container" });
  safeCall("Dashboard KPIs", () => { if (typeof renderKPI === "function") return renderKPI(); }, { containerId: "kpi" });
  safeCall("Cashflow curve", () => { if (typeof renderCashflowCurve === "function") return renderCashflowCurve(); }, { containerId: "view-dashboard" });
  safeCall("Charts", () => { if (typeof renderCharts === "function") return renderCharts(); }, { containerId: "view-dashboard" });
  safeCall("Transactions", () => { if (typeof renderTransactions === "function") return renderTransactions(); }, { containerId: "view-transactions" });
  safeCall("Settings", () => { if (typeof renderSettings === "function") return renderSettings(); }, { containerId: "view-settings" });
  safeCall("Redraw charts", () => { if (typeof tbRequestRedrawCharts === "function") return tbRequestRedrawCharts("renderAll");
      if (typeof redrawCharts === "function") return redrawCharts(); }, { containerId: "view-dashboard" });
}