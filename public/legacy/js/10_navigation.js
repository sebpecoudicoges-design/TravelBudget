/* =========================
   Navigation
   ========================= */
function setActiveTab(view) {
  try {
    document.body.dataset.tbView = String(view || "dashboard");
    document.body.classList.toggle("tb-view-dashboard", view === "dashboard");
  } catch (_) {}
  const tabs = [
    ["dashboard", "tab-dashboard", "view-dashboard"],
    ["transactions", "tab-transactions", "view-transactions"],
    ["settings", "tab-settings", "view-settings"],
    ["analysis", "tab-analysis", "view-analysis"],
    ["assets", "tab-assets", "view-assets"],
    ["documents", "tab-documents", "view-documents"],
    ["inbox", "tab-inbox", "view-inbox"],
    ["sport", "tab-sport", "view-sport"],
    ["work", "tab-work", "view-work"],
    ["nutrition", "tab-nutrition", "view-nutrition"],
    ["notifications", "tab-notifications", "view-notifications"],
    ["trip", "tab-trip", "view-trip"],
    ["testing", "tab-testing", "view-testing"],
    ["members", "tab-members", "view-members"],
    ["help", "tab-help", "view-help"],
    ["validation", null, "view-validation"],
  ];
  for (const [name, tabId, viewId] of tabs) {
    const tab = document.getElementById(tabId);
    const viewEl = document.getElementById(viewId);
    if (tab) tab.classList.toggle("active", name === view);
    if (viewEl) viewEl.classList.toggle("hidden", name !== view);
  }
}
function showView(view) {
  try { if (typeof window.tbApplyUiModeToDocument === "function") window.tbApplyUiModeToDocument(); } catch (_) {}
  if (view === "health") view = "nutrition";
  const access = window.TBModuleAccess;
  if (access && typeof access.resolveAppView === "function") view = access.resolveAppView(view, window.sbRole);
  if (view === "members" && String(window.sbRole || "").trim().toLowerCase() !== "admin") view = "validation";
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
    const root = document.getElementById("analysis-summary");
    if (root) root.innerHTML = `<div class="muted">Chargement analyse...</div>`;
    const renderAnalysis = async () => {
      try {
        if (typeof window.tbEnsureDeferredData === "function") await window.tbEnsureDeferredData("analysis");
        if ((window.activeView || activeView) !== "analysis") return;
        if (typeof window.tbRequestAnalysisRender === "function") window.tbRequestAnalysisRender("navigation");
        else if (typeof window.renderBudgetAnalysis === "function") await window.renderBudgetAnalysis();
      } catch (e) {
        console.error("[TB] Analysis render failed", e);
        alert(`Analyse indisponible : ${e?.message || e}`);
      }
    };
    if (typeof window.renderBudgetAnalysis === "function") {
      renderAnalysis();
    } else if (typeof window.tbLoadLegacyDomain === "function") {
      window.tbLoadLegacyDomain("analysis").then(renderAnalysis).catch((e) => {
        console.error("[TB] Analysis lazy load failed", e);
        alert(`Analyse indisponible : ${e?.message || e}`);
      });
    }
    try { if (typeof window.renderFxDecision === "function") window.renderFxDecision(false); } catch (_) {}
  }
  if (view === "assets") {
    if (typeof window.renderAssets === "function") window.renderAssets("navigation");
    else if (typeof window.tbLoadLegacyDomain === "function") {
      window.tbLoadLegacyDomain("assets").then(() => {
        if ((window.activeView || activeView) === "assets" && typeof window.renderAssets === "function") window.renderAssets("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Assets lazy load failed", e);
        alert(`Patrimoine indisponible : ${e?.message || e}`);
      });
    }
  }
  if (view === "documents") {
    if (typeof window.renderDocuments === "function") window.renderDocuments("navigation");
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("documents-root");
      if (root) root.innerHTML = `<div class="muted">Chargement documents...</div>`;
      window.tbLoadLegacyDomain("documents").then(() => {
        if ((window.activeView || activeView) === "documents" && typeof window.renderDocuments === "function") window.renderDocuments("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Documents lazy load failed", e);
        alert(`Documents indisponibles : ${e?.message || e}`);
      });
    }
  }
  if (view === "inbox") {
    if (typeof window.renderInbox === "function") window.renderInbox("navigation");
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("inbox-root");
      if (root) root.innerHTML = `<div class="muted">Chargement à traiter...</div>`;
      window.tbLoadLegacyDomain("inbox").then(() => {
        if ((window.activeView || activeView) === "inbox" && typeof window.renderInbox === "function") window.renderInbox("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Inbox lazy load failed", e);
        alert(`À traiter indisponible : ${e?.message || e}`);
      });
    }
  }
  if (view === "sport") {
    if (typeof window.renderSport === "function") window.renderSport("navigation");
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("sport-root");
      if (root) root.innerHTML = `<div class="muted">Chargement sport...</div>`;
      window.tbLoadLegacyDomain("sport").then(() => {
        if ((window.activeView || activeView) === "sport" && typeof window.renderSport === "function") window.renderSport("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Sport lazy load failed", e);
        alert(`Sport indisponible : ${e?.message || e}`);
      });
    }
  }
  if (view === "work") {
    if (typeof window.renderWork === "function") window.renderWork("navigation");
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("work-root");
      if (root) root.innerHTML = `<div class="muted">Chargement travail...</div>`;
      window.tbLoadLegacyDomain("work").then(() => {
        if ((window.activeView || activeView) === "work" && typeof window.renderWork === "function") window.renderWork("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Work lazy load failed", e);
        alert(`Travail indisponible : ${e?.message || e}`);
      });
    }
  }
  if (view === "nutrition") {
    if (typeof window.renderNutrition === "function") window.renderNutrition("navigation");
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("nutrition-root");
      if (root) root.innerHTML = `<div class="muted">Chargement alimentation...</div>`;
      window.tbLoadLegacyDomain("nutrition").then(() => {
        if ((window.activeView || activeView) === "nutrition" && typeof window.renderNutrition === "function") window.renderNutrition("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Nutrition lazy load failed", e);
        alert(`Alimentation indisponible : ${e?.message || e}`);
      });
    }
  }
  if (view === "notifications") {
    if (typeof window.renderNotifications === "function") window.renderNotifications("navigation");
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("notifications-root");
      if (root) root.innerHTML = `<div class="card"><div class="muted">Chargement notifications...</div></div>`;
      window.tbLoadLegacyDomain("notifications").then(() => {
        if ((window.activeView || activeView) === "notifications" && typeof window.renderNotifications === "function") window.renderNotifications("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Notifications lazy load failed", e);
        alert(`Notifications indisponibles : ${e?.message || e}`);
      });
    }
  }
  if (view === "dashboard") {
    try {
      if (typeof window.tbRenderDashboardCritical === "function") window.tbRenderDashboardCritical("navigation:dashboard", { cashflow: false });
      else if (typeof window.renderAll === "function") window.renderAll();
    } catch (_) {}
    try { if (typeof window.tbEnsureCashflowCurve === "function") window.tbEnsureCashflowCurve("navigation:dashboard"); } catch (_) {}
    if (typeof tbRequestRedrawCharts === "function") tbRequestRedrawCharts("10_navigation.js"); else redrawCharts();
  }
  if (view === "trip") {
    if (typeof window.renderTrip === "function") window.renderTrip();
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("trip-root");
      if (root) root.innerHTML = `<div class="card"><div class="muted">Chargement partage...</div></div>`;
      window.tbLoadLegacyDomain("trip").then(() => {
        if ((window.activeView || activeView) === "trip" && typeof window.renderTrip === "function") window.renderTrip("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Trip lazy load failed", e);
        alert(`Partage indisponible : ${e?.message || e}`);
      });
    }
  }
  if (view === "members") {
    if (typeof window.renderMembersAdmin === "function") window.renderMembersAdmin();
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("members-root");
      if (root) root.innerHTML = `<div class="card"><div class="muted">Chargement membres...</div></div>`;
      window.tbLoadLegacyDomain("trip").then(() => {
        if ((window.activeView || activeView) === "members" && typeof window.renderMembersAdmin === "function") window.renderMembersAdmin("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Members lazy load failed", e);
        alert(`Membres indisponible : ${e?.message || e}`);
      });
    }
  }
  if (view === "testing") {
    if (typeof window.renderTestCampaignApp === "function") window.renderTestCampaignApp("navigation");
  }
  if (view === "help") {
    if (typeof renderHelpFaq === "function") renderHelpFaq();
    else if (typeof window.tbLoadLegacyDomain === "function") {
      const root = document.getElementById("help-root");
      if (root) root.innerHTML = `<div class="muted">Chargement aide...</div>`;
      window.tbLoadLegacyDomain("help").then(() => {
        if ((window.activeView || activeView) === "help" && typeof window.renderHelpFaq === "function") window.renderHelpFaq("navigation:lazy");
      }).catch((e) => {
        console.error("[TB] Help lazy load failed", e);
        alert(`Aide indisponible : ${e?.message || e}`);
      });
    }
  }
}



function syncTabsForRole() {
  const role = String(window.sbRole || "").trim().toLowerCase();
  const roleState = window.TBModuleAccess?.roleUiState
    ? window.TBModuleAccess.roleUiState(role)
    : { isAdmin: role === "admin", isTester: role === "test", canPreviewModules: role === "admin" || role === "test", canUseTestCampaign: role === "admin" || role === "test", isRestricted: role !== "admin" && role !== "test" };
  const moduleTabs = [
    'dashboard','transactions','analysis','assets','sport','nutrition','work','documents','inbox','notifications','trip'
  ];
  try {
    document.body.classList.toggle("tb-role-admin", roleState.isAdmin);
    document.body.classList.toggle("tb-role-test", roleState.isTester);
    document.body.classList.toggle("tb-role-restricted", roleState.isRestricted);
    document.body.dataset.tbRole = roleState.role || role || 'user';
  } catch (_) {}
  moduleTabs.forEach((name) => {
    const tab = document.getElementById(`tab-${name}`);
    if (tab) tab.style.display = roleState.canPreviewModules ? 'flex' : 'none';
  });
  const testingTab = document.getElementById('tab-testing');
  if (testingTab) testingTab.style.display = roleState.canUseTestCampaign ? 'flex' : 'none';
  const membersTab = document.getElementById('tab-members');
  if (membersTab) membersTab.style.display = roleState.isAdmin ? 'flex' : 'none';
  if (!roleState.canPreviewModules && typeof activeView !== 'undefined' && !['settings', 'help', 'validation'].includes(activeView)) {
    showView('validation');
  }
}
