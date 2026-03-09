window.__TB_BUILD = "8.5.5";
/* =========================
   Boot
   ========================= */
window.onload = async function () {
  try { if (window.tbApplyI18nDom) tbApplyI18nDom(); } catch (_) {}

  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:onload"); } catch (_) {}
  window.__TB_BOOTING = true;


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

  sb.auth.onAuthStateChange((_event, session) => {
    sbUser = session?.user || null;
    try { if (typeof window.tbAuthScopeSync === "function") window.tbAuthScopeSync(sbUser?.id || ""); } catch (_) {}
    if (!sbUser) safeShowAuth(true, "Session expirée. Reconnecte-toi.");
  });

  const { data, error } = await sb.auth.getSession();
  if (error) { safeShowAuth(true, error.message); return; }

  sbUser = data.session?.user || null;
  try { if (typeof window.tbAuthScopeSync === "function") window.tbAuthScopeSync(sbUser?.id || ""); } catch (_) {}

  if (!sbUser) {
    safeShowAuth(true, "Connecte-toi pour synchroniser.");
    return;
  }

  try {
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:ensureBootstrap"); } catch (_) {}
    await ensureBootstrap();
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:ensureBootstrap"); } catch (_) {}

    // ✅ IMPORTANT: afficher la vue AVANT refreshFromServer(),
    // sinon renderKPI peut chercher des nodes qui n’existent pas encore
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:showView"); } catch (_) {}
    showView("dashboard");
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:showView"); } catch (_) {}

    // Laisse le DOM de la vue se poser
    await new Promise(r => setTimeout(r, 0));

    // Perf (A2): do not block UI on network refresh.
    // Show the dashboard immediately and refresh in background.
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:refreshFromServer"); } catch (_) {}
    const _refreshPromise = (typeof refreshFromServer === "function")
      ? refreshFromServer()
      : Promise.resolve();
    try {
      _refreshPromise
        .catch((e) => {
          // Avoid hard crash during boot; refreshFromServer already logs/alerts.
          console.warn("[Boot] refreshFromServer failed:", e?.message || e);
        })
        .finally(() => {
          try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:refreshFromServer"); } catch (_) {}
        });
    } catch (_) {
      try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:refreshFromServer"); } catch (_) {}
    }

    // Hide auth overlay right away; data hydrates in background.
    safeShowAuth(false);

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (activeView !== "dashboard") return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){ if (window.tbRequestRedrawCharts) tbRequestRedrawCharts("resize"); else if (typeof redrawCharts==="function") redrawCharts(); }, 150);
    });
  } catch (e) {
    safeShowAuth(true, `Erreur init: ${e?.message || e}`);
  } finally {
    // Release coalesced renders scheduled during boot
    window.__TB_BOOTING = false;
    try { if (typeof window.tbReleaseBootRenders === "function") window.tbReleaseBootRenders();
  if (window.__TB_BOOT_NEEDS_CASHFLOW_CURVE && typeof tbRequestCashflowCurveRender === "function") {
    window.__TB_BOOT_NEEDS_CASHFLOW_CURVE = false;
    tbRequestCashflowCurveRender("boot-release");
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
  }
};