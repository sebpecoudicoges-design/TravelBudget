/* =========================
   Boot
   ========================= */

function tbEnsureBootOverlay() {
  let el = document.getElementById("tb-boot-overlay");
  if (el) {
    try {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
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
      <div style="min-width:240px;max-width:86vw;padding:18px 20px;border-radius:20px;background:rgba(17,24,39,.92);color:#fff;box-shadow:0 18px 48px rgba(0,0,0,.28);display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;border:1px solid rgba(255,255,255,.08);">
        <div style="width:32px;height:32px;border-radius:999px;border:3px solid rgba(255,255,255,.22);border-top-color:#fff;animation:tbBootSpin .8s linear infinite;"></div>
        <div style="font-weight:700;font-size:15px;">Chargement de ton budget…</div>
        <div id="tb-boot-overlay-text" style="font-size:12px;opacity:.82;">Préparation des données et des vues</div>
      </div>`;
    if (!document.getElementById("tb-boot-overlay-style")) {
      const style = document.createElement("style");
      style.id = "tb-boot-overlay-style";
      style.textContent = '@keyframes tbBootSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(el);
  } catch (_) {}
  return el;
}

function tbShowBootOverlay(text) {
  try {
    const el = tbEnsureBootOverlay();
    if (!el) return;
    const msg = document.getElementById("tb-boot-overlay-text");
    if (msg && text) msg.textContent = text;
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
  } catch (_) {}
}

function tbHideBootOverlay() {
  try {
    const el = document.getElementById("tb-boot-overlay");
    if (!el) return;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 260);
  } catch (_) {}
}

window.onload = async function () {
  try { if (window.tbApplyI18nDom) tbApplyI18nDom(); } catch (_) {}

  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:onload"); } catch (_) {}
  window.__TB_BOOTING = true;
  const __tbBootStartedAt = Date.now();
  try { tbShowBootOverlay("Initialisation de l’application"); } catch (_) {}


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
  if (error) { safeShowAuth(true, error.message); try { tbHideBootOverlay(); } catch (_) {} return; }

  sbUser = data.session?.user || null;
  try { if (typeof window.tbAuthScopeSync === "function") window.tbAuthScopeSync(sbUser?.id || ""); } catch (_) {}

  if (!sbUser) {
    safeShowAuth(true, "Connecte-toi pour synchroniser.");
    try { tbHideBootOverlay(); } catch (_) {}
    return;
  }

  try {
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:ensureBootstrap"); } catch (_) {}
    try { tbShowBootOverlay("Connexion et synchronisation…"); } catch (_) {}
    // Launch bootstrap but do not block first render
    const _bootstrapPromise = ensureBootstrap();
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
    try { tbShowBootOverlay("Chargement des transactions, wallets et graphiques…"); } catch (_) {}
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("boot:refreshFromServer"); } catch (_) {}

    _bootstrapPromise.catch(e => {
      console.warn("[Boot] ensureBootstrap failed:", e?.message || e);
    });

    // Refresh serveur en parallèle
const _refreshPromise = (typeof loadTravels === "function")
  ? (async () => {
      await loadTravels();

      if (!state.activeTravelId && Array.isArray(state.travels) && state.travels.length) {
        state.activeTravelId = state.travels[0].id;
      }

      if (typeof loadTravelContext === "function") {
        await loadTravelContext();
      } else if (typeof refreshFromServer === "function") {
        await refreshFromServer({ skipRender: true });
      }
    })()
  : ((typeof refreshFromServer === "function")
      ? refreshFromServer({ skipRender: true })
      : Promise.resolve());
    try {
      _refreshPromise
        .catch((e) => {
          // Avoid hard crash during boot; refreshFromServer already logs/alerts.
          console.warn("[Boot] refreshFromServer failed:", e?.message || e);
        })
        .finally(async () => {
          try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:refreshFromServer"); } catch (_) {}
          try {
            const elapsed = Date.now() - __tbBootStartedAt;
            const wait = Math.max(0, 500 - elapsed);
            if (wait) await new Promise(r => setTimeout(r, wait));
            tbHideBootOverlay();
          } catch (_) {}
        });
    } catch (_) {
      try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("boot:refreshFromServer"); } catch (_) {}
      try { tbHideBootOverlay(); } catch (_) {}
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
    try { tbHideBootOverlay(); } catch (_) {}
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