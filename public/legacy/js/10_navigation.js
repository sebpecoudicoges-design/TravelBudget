/* =========================
   Navigation
   ========================= */
function setActiveTab(view) {
  const tabs = [
    ["dashboard", "tab-dashboard", "view-dashboard"],
    ["transactions", "tab-transactions", "view-transactions"],
    ["settings", "tab-settings", "view-settings"],
    ["trip", "tab-trip", "view-trip"],
  ];
  for (const [name, tabId, viewId] of tabs) {
    document.getElementById(tabId).classList.toggle("active", name === view);
    document.getElementById(viewId).classList.toggle("hidden", name !== view);
  }
}
function showView(view) {
  activeView = view;
  setActiveTab(view);
  if (view === "transactions") renderTransactions();
  if (view === "settings") { renderSettings(); initPaletteUI(); }
  if (view === "dashboard") redrawCharts();
  if (view === "trip") renderTrip();
}

