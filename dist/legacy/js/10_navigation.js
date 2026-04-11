/* =========================
   Navigation
   ========================= */
function setActiveTab(view) {
  const tabs = [
    ["dashboard", "tab-dashboard", "view-dashboard"],
    ["transactions", "tab-transactions", "view-transactions"],
    ["settings", "tab-settings", "view-settings"],
    ["analysis", "tab-analysis", "view-analysis"],
    ["trip", "tab-trip", "view-trip"],
    ["members", "tab-members", "view-members"],
    ["help", "tab-help", "view-help"],
  ];
  for (const [name, tabId, viewId] of tabs) {
    document.getElementById(tabId).classList.toggle("active", name === view);
    document.getElementById(viewId).classList.toggle("hidden", name !== view);
  }
}
function showView(view) {
  try { if (typeof window.tbApplyUiModeToDocument === "function") window.tbApplyUiModeToDocument(); } catch (_) {}
  if (view === "members" && typeof window.tbIsSimpleMode === "function" && window.tbIsSimpleMode()) view = "dashboard";
  activeView = view;
  setActiveTab(view);
  if (view === "transactions") renderTransactions();
  if (view === "settings") { renderSettings(); initPaletteUI(); }
  if (view === "analysis") { if (typeof tbRequestAnalysisRender === 'function') tbRequestAnalysisRender('navigation'); else if (typeof renderBudgetAnalysis === 'function') renderBudgetAnalysis(); }
  if (view === "dashboard") if (typeof tbRequestRedrawCharts === "function") tbRequestRedrawCharts("10_navigation.js"); else redrawCharts();
  if (view === "trip") renderTrip();
  if (view === "members") renderMembersAdmin();
  if (view === "help") { if (typeof renderHelpFaq === "function") renderHelpFaq(); }
}



function syncTabsForRole() {
  const isAdmin = (window.sbRole === 'admin');
  const simple = (typeof window.tbIsSimpleMode === 'function') ? window.tbIsSimpleMode() : false;
  const tab = document.getElementById('tab-members');
  if (tab) tab.style.display = (isAdmin && !simple) ? 'block' : 'none';
  // if user is not admin and is currently on members view, bounce to dashboard
  if ((!isAdmin || simple) && (typeof activeView !== 'undefined') && activeView === 'members') showView('dashboard');
}
