/* =========================
   Main render
   ========================= */
function renderAll() {
  try { if (typeof renderWallets === "function") renderWallets(); } catch (e) { console.warn("[renderAll] renderWallets failed", e); }
  try { if (typeof renderDailyBudget === "function") renderDailyBudget(); } catch (e) { console.warn("[renderAll] renderDailyBudget failed", e); }
  try { if (typeof renderTransactions === "function") renderTransactions(); } catch (e) { console.warn("[renderAll] renderTransactions failed", e); }
  try { if (typeof renderSettings === "function") renderSettings(); } catch (e) { console.warn("[renderAll] renderSettings failed", e); }
  try { if (typeof redrawCharts === "function") redrawCharts(); } catch (e) { console.warn("[renderAll] redrawCharts failed", e); }
}