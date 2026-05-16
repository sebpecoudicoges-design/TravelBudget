/* =========================
   Navigation
   ========================= */
function setActiveTab(view) {
  const tabs = [
    ["dashboard", "tab-dashboard", "view-dashboard"],
    ["transactions", "tab-transactions", "view-transactions"],
    ["settings", "tab-settings", "view-settings"],
    ["analysis", "tab-analysis", "view-analysis"],
    ["assets", "tab-assets", "view-assets"],
    ["documents", "tab-documents", "view-documents"],
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
  try { if (typeof window !== "undefined") window.activeView = view; } catch (_) {}
  try { if (window.tbBus && typeof window.tbBus.emit === "function") window.tbBus.emit("view:changed", { view }); } catch (_) {}
  setActiveTab(view);
  if (view === "transactions") {
    renderTransactions();
    try { if (typeof window.tbEnsureDeferredData === "function") window.tbEnsureDeferredData("transactions"); } catch (_) {}
  }
  if (view === "settings") {
    renderSettings();
    initPaletteUI();
    try { if (typeof window.tbEnsureGovernanceData === "function") window.tbEnsureGovernanceData("settings"); } catch (_) {}
  }
  if (view === "analysis") {
    try { if (typeof window.tbEnsureGovernanceData === "function") window.tbEnsureGovernanceData("analysis"); } catch (_) {}
    if (typeof tbRequestAnalysisRender === 'function') tbRequestAnalysisRender('navigation'); else if (typeof renderBudgetAnalysis === 'function') renderBudgetAnalysis();
    try { if (typeof window.renderFxDecision === "function") window.renderFxDecision(false); } catch (_) {}
  }
  if (view === "assets") { if (typeof window.renderAssets === "function") window.renderAssets("navigation"); }
  if (view === "documents") { if (typeof window.renderDocuments === "function") window.renderDocuments("navigation"); }
  if (view === "dashboard") {
    if (typeof tbRequestRedrawCharts === "function") tbRequestRedrawCharts("10_navigation.js"); else redrawCharts();
  }
  if (view === "trip") renderTrip();
  if (view === "members") renderMembersAdmin();
  if (view === "help") { if (typeof renderHelpFaq === "function") renderHelpFaq(); }
}



function syncTabsForRole() {
  const isAdmin = (window.sbRole === 'admin');
  const simple = (typeof window.tbIsSimpleMode === 'function') ? window.tbIsSimpleMode() : false;
  const tab = document.getElementById('tab-members');
  if (tab) tab.style.display = (isAdmin && !simple) ? 'flex' : 'none';
  // if user is not admin and is currently on members view, bounce to dashboard
  if ((!isAdmin || simple) && (typeof activeView !== 'undefined') && activeView === 'members') showView('dashboard');
}
