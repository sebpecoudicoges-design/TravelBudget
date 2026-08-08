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
            <div class="tb-boot-title">Préparation de votre espace</div>
            <div id="tb-boot-version" class="tb-boot-version">Version TB ${window.TB_VERSION || window.__TB_BUILD || "dev"}</div>
          </div>
          <div id="tb-boot-percent" class="tb-boot-percent">0%</div>
        </div>
        <div class="tb-boot-track" aria-hidden="true"><i id="tb-boot-progress" class="tb-boot-bar"></i></div>
        <div id="tb-boot-overlay-text" class="tb-boot-text">Préparation des données et des vues</div>
        <div class="tb-boot-steps" aria-hidden="true"><span class="tb-boot-step"><i></i></span><span class="tb-boot-step"><i></i></span><span class="tb-boot-step"><i></i></span><span class="tb-boot-step"><i></i></span></div>
        <p class="tb-boot-note">Vos données restent dans votre espace privé pendant la synchronisation.</p>
      </div>`;
    if (!document.getElementById("tb-boot-overlay-style")) {
      const style = document.createElement("style");
      style.id = "tb-boot-overlay-style";
      style.textContent = '#tb-boot-overlay .tb-boot-card{min-width:240px;max-width:86vw;padding:18px 20px;border-radius:26px;background:#fff;color:#20313a;display:flex;flex-direction:column;gap:12px;border:1px solid #f0dccb;box-shadow:0 18px 46px rgba(80,55,37,.12)}#tb-boot-overlay .tb-boot-head{display:flex;align-items:center;justify-content:space-between;gap:12px}#tb-boot-overlay .tb-boot-mark{font-weight:900;color:#fff;background:#ff6b4a;border-radius:14px;padding:9px}#tb-boot-overlay .tb-boot-progress,#tb-boot-overlay .tb-boot-track{height:10px;border-radius:999px;background:#fff1e3;overflow:hidden}#tb-boot-overlay .tb-boot-bar{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff6b4a,#23b5af);transition:width .28s ease}#tb-boot-overlay .tb-boot-steps{display:none}#tb-boot-overlay .tb-boot-note{color:#687c86;font-size:11px}';
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

let _tbDashboardFirstPaintTimer = null;
function tbFinalizeDashboardFirstPaint(reason, attempt) {
  const view = String(window.activeView || (typeof activeView === "string" ? activeView : "") || "dashboard");
  if (!window.sbUser || view !== "dashboard") return false;
  try { window.tbRenderDashboardCritical?.(reason || "boot:final-paint", { cashflow: false }); } catch (_) {}
  try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
  try { window.tbEnsureCashflowCurve?.(reason || "boot:final-paint"); } catch (_) {}
  const walletsReady = !!document.getElementById("wallets-container")?.childElementCount;
  const budgetReady = !!document.getElementById("daily-budget-container")?.childElementCount;
  const cashflowReady = !!document.getElementById("solde-projection-container")?.childElementCount;
  const ready = walletsReady && budgetReady && cashflowReady;
  const nextAttempt = Number(attempt || 0) + 1;
  if (!ready && nextAttempt < 20) {
    clearTimeout(_tbDashboardFirstPaintTimer);
    _tbDashboardFirstPaintTimer = setTimeout(() => tbFinalizeDashboardFirstPaint(reason || "boot:readiness", nextAttempt), 250);
  }
  return ready;
}
window.tbFinalizeDashboardFirstPaint = tbFinalizeDashboardFirstPaint;

async function tbHydrateDashboardAfterInitialData(reason) {
  const view = String(window.activeView || (typeof activeView === "string" ? activeView : "") || "dashboard");
  if (view !== "dashboard") return false;
  try { await window.TBLoadDashboardDailyBudgetState?.(); } catch (_) {}
  try { if (typeof showView === "function") showView("dashboard"); } catch (_) {}
  try { window.tbRenderDashboardCritical?.(reason || "boot:data-ready", { cashflow: false }); } catch (_) {}
  try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
  try { window.tbEnsureCashflowCurve?.(reason || "boot:data-ready"); } catch (_) {}
  return tbFinalizeDashboardFirstPaint(reason || "boot:data-ready", 0);
}
window.tbHydrateDashboardAfterInitialData = tbHydrateDashboardAfterInitialData;

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
    // Resolve the server-owned role before choosing the first protected view. Otherwise a
    // tester/admin session can briefly look like a standard user and be routed to Validation;
    // the Dashboard then stays empty until a manual navigation forces another render.
    const _bootstrapPromise = ensureBootstrap();
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:ensureBootstrap"); } catch (_) {}

    try {
      await _bootstrapPromise;
    } catch (e) {
      console.warn("[Boot] ensureBootstrap failed:", e?.message || e);
    }

    // Keep the Dashboard DOM mounted before refreshFromServer(), but only after access
    // resolution so showView() cannot redirect a legitimate tester/admin to Validation.
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
      if (typeof refreshFromServer === "function") await refreshFromServer({ force: false });
      try { await tbHydrateDashboardAfterInitialData("boot:post-refresh"); } catch (_) {}
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
      const schedule = window.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
      schedule(() => schedule(() => tbFinalizeDashboardFirstPaint("boot:after-gate", 0)));
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

