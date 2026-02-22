/* =========================
   Navigation
   ========================= */
function setActiveTab(view) {
  const tabs = [
    ["dashboard", "tab-dashboard", "view-dashboard"],
    ["transactions", "tab-transactions", "view-transactions"],
    ["settings", "tab-settings", "view-settings"],
    ["trip", "tab-trip", "view-trip"],
    ["members", "tab-members", "view-members"],
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
  if (view === "members") renderMembersAdmin();
}



function syncTabsForRole() {
  const isAdmin = (window.sbRole === 'admin');
  const tab = document.getElementById('tab-members');
  if (tab) tab.style.display = isAdmin ? 'block' : 'none';
  // if user is not admin and is currently on members view, bounce to dashboard
  if (!isAdmin && (typeof activeView !== 'undefined') && activeView === 'members') showView('dashboard');
}
