/* =========================
   Boot
   ========================= */

function tbEnsureBootOverlay() {
  let el = document.getElementById("tb-boot-overlay");
  if (el) {
    try {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      const version = document.getElementById("tb-boot-version");
      if (version) version.textContent = `Version TB ${window.TB_VERSION || window.__TB_BUILD || "dev"}`;
    } catch (_) {}
    return el;
  }
  try {
    el = document.createElement("div");
    el.id = "tb-boot-overlay";
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:10000",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(15,23,42,.78)",
      "backdrop-filter:blur(10px)",
      "-webkit-backdrop-filter:blur(10px)",
      "opacity:1",
      "pointer-events:auto",
      "transition:opacity .22s ease"
    ].join(";");
    el.innerHTML = `
      <div class="tb-boot-card">
        <div class="tb-boot-head">
          <div class="tb-boot-mark">TB</div>
          <div class="tb-boot-copy">
            <div class="tb-boot-title">Synchronisation TravelBudget</div>
            <div id="tb-boot-version" class="tb-boot-version">Version TB ${window.TB_VERSION || window.__TB_BUILD || "dev"}</div>
          </div>
          <div id="tb-boot-percent" class="tb-boot-percent">0%</div>
        </div>
        <div class="tb-boot-track" aria-hidden="true"><i id="tb-boot-progress" class="tb-boot-bar"></i></div>
        <div id="tb-boot-overlay-text" class="tb-boot-text">Préparation des données et des vues</div>
        <div class="tb-boot-steps" aria-hidden="true"><span class="tb-boot-step"><i></i></span><span class="tb-boot-step"><i></i></span><span class="tb-boot-step"><i></i></span><span class="tb-boot-step"><i></i></span></div>
      </div>`;
    if (!document.getElementById("tb-boot-overlay-style")) {
      const style = document.createElement("style");
      style.id = "tb-boot-overlay-style";
      style.textContent = `
        #tb-boot-overlay{padding:22px;overflow:hidden;color:#e0f2fe;background:linear-gradient(115deg,rgba(2,6,23,.94),rgba(8,47,73,.92) 46%,rgba(15,23,42,.96)),repeating-linear-gradient(90deg,rgba(125,211,252,.08) 0 1px,transparent 1px 64px),repeating-linear-gradient(0deg,rgba(34,197,94,.045) 0 1px,transparent 1px 56px)!important;}
        #tb-boot-overlay::before{content:"";position:absolute;inset:-35% -20%;background:linear-gradient(90deg,transparent 28%,rgba(56,189,248,.18),rgba(34,197,94,.12),transparent 72%);transform:rotate(-12deg);animation:tbBootSweep 2.8s linear infinite;pointer-events:none;}
        #tb-boot-overlay::after{content:"";position:absolute;inset:18px;border:1px solid rgba(125,211,252,.18);border-radius:30px;box-shadow:inset 0 0 42px rgba(14,165,233,.12);pointer-events:none;}
        #tb-boot-overlay .tb-boot-card{position:relative;z-index:1;width:min(430px,92vw);padding:22px;border-radius:24px;background:rgba(15,23,42,.74);color:#f8fafc;box-shadow:0 28px 80px rgba(2,6,23,.44),inset 0 1px 0 rgba(255,255,255,.10);display:flex;flex-direction:column;gap:14px;text-align:left;border:1px solid rgba(125,211,252,.22);overflow:hidden;}
        #tb-boot-overlay .tb-boot-card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#22c55e,#38bdf8,#2563eb);}
        #tb-boot-overlay .tb-boot-head{display:flex;align-items:center;justify-content:space-between;gap:14px;}
        #tb-boot-overlay .tb-boot-mark{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;color:#bae6fd;font-weight:950;letter-spacing:.02em;background:linear-gradient(145deg,rgba(14,165,233,.28),rgba(34,197,94,.16));border:1px solid rgba(186,230,253,.28);box-shadow:0 0 32px rgba(14,165,233,.18);}
        #tb-boot-overlay .tb-boot-copy{min-width:0;flex:1;}
        #tb-boot-overlay .tb-boot-title{font-weight:900;font-size:18px;line-height:1.08;}
        #tb-boot-overlay .tb-boot-version{margin-top:4px;font-size:11px;color:#93c5fd;font-weight:850;}
        #tb-boot-overlay .tb-boot-percent{font-size:30px;line-height:1;font-weight:950;color:#fff;min-width:74px;text-align:right;}
        #tb-boot-overlay .tb-boot-track{height:12px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(125,211,252,.18);}
        #tb-boot-overlay .tb-boot-bar{display:block;width:0%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#22c55e,#38bdf8,#60a5fa);box-shadow:0 0 24px rgba(56,189,248,.42);transition:width .28s ease;}
        #tb-boot-overlay .tb-boot-text{font-size:13px;color:#cbd5e1;font-weight:720;min-height:18px;}
        #tb-boot-overlay .tb-boot-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
        #tb-boot-overlay .tb-boot-step{height:5px;border-radius:999px;background:rgba(148,163,184,.20);overflow:hidden;}
        #tb-boot-overlay .tb-boot-step i{display:block;height:100%;width:0%;border-radius:inherit;background:#38bdf8;transition:width .3s ease;}
        #tb-boot-overlay[data-phase="data"] .tb-boot-step:nth-child(1) i,#tb-boot-overlay[data-phase="views"] .tb-boot-step:nth-child(-n+2) i,#tb-boot-overlay[data-phase="sync"] .tb-boot-step:nth-child(-n+3) i,#tb-boot-overlay[data-phase="ready"] .tb-boot-step i{width:100%;}
        @keyframes tbBootSweep{from{transform:translateX(-45%) rotate(-12deg)}to{transform:translateX(45%) rotate(-12deg)}}
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(el);
  } catch (_) {}
  return el;
}

function tbSetBootProgress(progress, text, phase) {
  try {
    const el = tbEnsureBootOverlay();
    if (!el) return;
    const msg = document.getElementById("tb-boot-overlay-text");
    if (msg && text) msg.textContent = text;
    if (phase) el.setAttribute("data-phase", phase);
    const safeProgress = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
    const pct = document.getElementById("tb-boot-percent");
    const bar = document.getElementById("tb-boot-progress");
    if (pct) pct.textContent = `${safeProgress}%`;
    if (bar) bar.style.width = `${safeProgress}%`;
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
  } catch (_) {}
}

function tbShowBootOverlay(text, progress, phase) {
  tbSetBootProgress(progress == null ? (window.__TB_BOOT_PROGRESS__ || 8) : progress, text, phase);
}

function tbHideBootOverlay() {
  try {
    const el = document.getElementById("tb-boot-overlay");
    if (!el) return;
    tbSetBootProgress(100, "Prêt", "ready");
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 320);
  } catch (_) {}
}

window.onload = async function () {
  try { if (window.tbApplyI18nDom) tbApplyI18nDom(); } catch (_) {}

  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:onload"); } catch (_) {}
  window.__TB_BOOTING = true;
  window.__TB_BOOT_COMPLETED__ = false;
  const __tbBootStartedAt = Date.now();
  try { tbShowBootOverlay("Initialisation de l’application", 12, "data"); } catch (_) {}


  // ✅ Post invite/recovery: laisse la page se stabiliser
  const postAuth = sessionStorage.getItem("tb_post_auth_redirect") === "1";
  if (postAuth) {
    sessionStorage.removeItem("tb_post_auth_redirect");
    // un petit délai suffit à éviter les null DOM dans certains navigateurs
    await new Promise(r => setTimeout(r, 150));
  }

  // Helper: showAuth peut planter si le DOM auth n'est pas encore monté
  const safeShowAuth = (show, msg) => {
    try {
      // showAuth est défini dans 03_ui_auth.js
      if (typeof showAuth === "function") showAuth(show, msg);
    } catch (e) {
      console.warn("[Boot] showAuth skipped (DOM not ready):", e);
    }
  };

  // theme (local first)
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  try { if (window.TB_PERF && TB_PERF.enabled) { TB_PERF.mark("boot:theme"); TB_PERF.end("boot:theme"); } } catch (_) {}

  // palette (local preview first, server will override after login)
  const storedPalette = getStoredPalette() || PALETTES["Ocean"];
  const storedPreset = getStoredPreset() || findPresetNameForPalette(storedPalette);
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:palette"); } catch (_) {}
  await applyPalette(storedPalette, storedPreset, { persistLocal: true, persistRemote: false });
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:palette"); } catch (_) {}

  sb.auth.onAuthStateChange(async (_event, session) => {
    const authEvent = String(_event || "").toUpperCase();
    const prevUid = sbUser?.id || "";
    sbUser = session?.user || null;
    window.sbUser = sbUser;
    const nextUid = sbUser?.id || "";
    let scope = { changed: prevUid !== nextUid, prev: prevUid, uid: nextUid };
    try { if (typeof window.tbAuthScopeSync === "function") scope = window.tbAuthScopeSync(nextUid) || scope; } catch (_) {}

    if (scope?.changed && typeof window.tbResetClientSessionState === 'function') {
      try { window.tbResetClientSessionState(`auth:${_event || 'changed'}`); } catch (_) {}
    }

    if (!sbUser) {
      if (authEvent !== "SIGNED_OUT" && !scope?.changed) return;
      safeShowAuth(true, "Session expirée. Reconnecte-toi.");
      return;
    }

    if (!window.__TB_BOOT_COMPLETED__) return;

    const sameUserWakeEvent = !scope?.changed && (
      authEvent === "INITIAL_SESSION"
      || authEvent === "TOKEN_REFRESHED"
      || authEvent === "USER_UPDATED"
      || authEvent === "SIGNED_IN"
    );
    if (sameUserWakeEvent) return;

    try {
      tbShowBootOverlay("Changement de compte… synchronisation", 38, "sync");
      showView("dashboard");
      const authOffline = (typeof window.tbShouldUseOfflineMode === "function")
        ? await window.tbShouldUseOfflineMode("auth-change")
        : (navigator && navigator.onLine === false);
      if (authOffline) {
        if (typeof window.tbRestoreOfflineSnapshot === "function" && window.tbRestoreOfflineSnapshot("auth-change:offline")) {
          try { if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("offline-auth-change"); else if (typeof renderAll === "function") renderAll(); } catch (_) {}
          safeShowAuth(false);
          return;
        }
      }
      if (typeof ensureBootstrap === "function") await ensureBootstrap();
      await refreshFromServer({ force: false });
      try { if (typeof window.tbRefreshTripInviteNotifications === "function") window.tbRefreshTripInviteNotifications(); } catch (_) {}
      safeShowAuth(false);
    } catch (e) {
      console.warn('[Boot] auth change refresh failed:', e?.message || e);
    } finally {
      try { tbHideBootOverlay(); } catch (_) {}
    }
  });

  const { data, error } = await sb.auth.getSession();
  if (error) { safeShowAuth(true, error.message); try { tbHideBootOverlay(); } catch (_) {} return; }

  sbUser = data.session?.user || null;
  window.sbUser = sbUser;
  try { if (typeof window.tbAuthScopeSync === "function") window.tbAuthScopeSync(sbUser?.id || ""); } catch (_) {}

  if (!sbUser) {
    safeShowAuth(true, "Connecte-toi pour synchroniser.");
    try { tbHideBootOverlay(); } catch (_) {}
    return;
  }

  try {
    if (typeof window.tbRestoreOfflineSnapshot === "function") {
      window.tbRestoreOfflineSnapshot("boot:prime");
    }
  } catch (_) {}

  try {
    const bootOffline = (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode("boot")
      : (navigator && navigator.onLine === false);
    if (bootOffline) {
      try { tbShowBootOverlay("Mode hors ligne : restauration locale...", 42, "views"); } catch (_) {}
      const restored = (typeof window.tbRestoreOfflineSnapshot === "function") && window.tbRestoreOfflineSnapshot("boot:offline");
      showView("dashboard");
      await new Promise(r => setTimeout(r, 0));
      if (restored) {
        try { if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("offline-boot"); else if (typeof renderAll === "function") renderAll(); } catch (_) {}
        try { if (typeof toastInfo === "function") toastInfo(window.tbOfflineMessage ? window.tbOfflineMessage() : "Mode hors ligne."); } catch (_) {}
      } else {
        try { if (typeof toastWarn === "function") toastWarn("Mode hors ligne : aucune sauvegarde locale disponible pour cet utilisateur."); } catch (_) {}
      }
      safeShowAuth(false);
      try {
        const elapsed = Date.now() - __tbBootStartedAt;
        const wait = Math.max(0, 500 - elapsed);
        if (wait) await new Promise(r => setTimeout(r, wait));
        tbHideBootOverlay();
      } catch (_) {}
      return;
    }

    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:ensureBootstrap"); } catch (_) {}
    try { tbShowBootOverlay("Connexion et synchronisation…", 34, "data"); } catch (_) {}
    // Launch bootstrap, then keep the boot overlay until the first useful refresh has hydrated
    // dashboard-critical data (wallets, KPI, budget, analysis inputs).
    const _bootstrapPromise = ensureBootstrap();
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:ensureBootstrap"); } catch (_) {}

    // ✅ IMPORTANT: afficher la vue AVANT refreshFromServer(),
    // sinon renderKPI peut chercher des nodes qui n’existent pas encore
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:showView"); } catch (_) {}
    showView("dashboard");
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:showView"); } catch (_) {}

    // Laisse le DOM de la vue se poser
    await new Promise(r => setTimeout(r, 0));

    // First refresh: keep it awaited on boot so the first mobile launch does not freeze on
    // empty KPI/wallet/analyse panels until the app is killed and reopened.
    try { tbShowBootOverlay("Chargement des transactions, wallets et graphiques…", 72, "sync"); } catch (_) {}
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:refreshFromServer"); } catch (_) {}

    try {
      await _bootstrapPromise;
    } catch (e) {
      console.warn("[Boot] ensureBootstrap failed:", e?.message || e);
    }

    try {
      if (typeof refreshFromServer === "function") await refreshFromServer({ force: false });
      try { if (typeof window.tbRenderDashboardCritical === "function") window.tbRenderDashboardCritical("boot:post-refresh", { cashflow: false }); } catch (_) {}
      try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
      try { if (typeof window.tbRefreshTripInviteNotifications === "function") window.tbRefreshTripInviteNotifications(); } catch (_) {}
      setTimeout(() => {
        try {
          const view = (typeof activeView === "string" && activeView) ? activeView : "dashboard";
          if (view !== "dashboard") return;
          if (typeof window.tbRenderDashboardCritical === "function") window.tbRenderDashboardCritical("boot:settle", { cashflow: false });
          if (typeof renderAll === "function") renderAll();
        } catch (_) {}
      }, 250);
    } catch (e) {
      // Avoid hard crash during boot; refreshFromServer already logs/alerts.
      console.warn("[Boot] refreshFromServer failed:", e?.message || e);
    } finally {
      try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:refreshFromServer"); } catch (_) {}
      try {
        const elapsed = Date.now() - __tbBootStartedAt;
        const wait = Math.max(0, 500 - elapsed);
        if (wait) await new Promise(r => setTimeout(r, wait));
        tbHideBootOverlay();
      } catch (_) {}
    }

    safeShowAuth(false);

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (activeView !== "dashboard") return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){ if (window.tbRequestRedrawCharts) tbRequestRedrawCharts("resize"); else if (typeof redrawCharts==="function") redrawCharts(); }, 150);
    });
  } catch (e) {
    safeShowAuth(true, `Erreur init: ${e?.message || e}`);
    try { tbHideBootOverlay(); } catch (_) {}
  } finally {
    // Release coalesced renders scheduled during boot
    window.__TB_BOOTING = false;
    window.__TB_BOOT_COMPLETED__ = true;
    try { if (typeof window.tbReleaseBootRenders === "function") window.tbReleaseBootRenders();
  if (window.__TB_BOOT_NEEDS_CASHFLOW_CURVE) {
    window.__TB_BOOT_NEEDS_CASHFLOW_CURVE = false;
    if (typeof window.tbEnsureCashflowCurve === "function") window.tbEnsureCashflowCurve("boot-release");
    else if (typeof tbRequestCashflowCurveRender === "function") tbRequestCashflowCurveRender("boot-release");
  }
 } catch (_) {}

    // Release deferred cashflow render scheduled during boot
    try {
      if (window.__TB_BOOT_NEEDS_CASHFLOW && typeof window.tbRequestCashflowRender === "function") {
        window.__TB_BOOT_NEEDS_CASHFLOW = false;
        window.tbRequestCashflowRender("boot-release");
      }
    } catch (_) {}
    try {
      if (window.TB_PERF && TB_PERF.enabled) {
        TB_PERF.end("boot:onload");
        TB_PERF.flush("boot");
      }
    } catch (_) {}
    try { if (typeof window.tbMaybeStartGuidedTour === "function") window.tbMaybeStartGuidedTour(); } catch (_) {}
  }
};

