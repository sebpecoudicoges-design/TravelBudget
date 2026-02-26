window.__TB_BUILD = "6.6.19";
/* =========================
   Boot
   ========================= */
window.onload = async function () {

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

  // palette (local preview first, server will override after login)
  const storedPalette = getStoredPalette() || PALETTES["Ocean"];
  const storedPreset = getStoredPreset() || findPresetNameForPalette(storedPalette);
  await applyPalette(storedPalette, storedPreset, { persistLocal: true, persistRemote: false });

  sb.auth.onAuthStateChange((_event, session) => {
    sbUser = session?.user || null;
    if (!sbUser) safeShowAuth(true, "Session expirée. Reconnecte-toi.");
  });

  const { data, error } = await sb.auth.getSession();
  if (error) { safeShowAuth(true, error.message); return; }

  sbUser = data.session?.user || null;

  if (!sbUser) {
    safeShowAuth(true, "Connecte-toi pour synchroniser.");
    return;
  }

  try {
    await ensureBootstrap();

    // ✅ IMPORTANT: afficher la vue AVANT refreshFromServer(),
    // sinon renderKPI peut chercher des nodes qui n’existent pas encore
    showView("dashboard");

    // Laisse le DOM de la vue se poser
    await new Promise(r => setTimeout(r, 0));

    await refreshFromServer(); // -> loadFromSupabase applies server palette + preset

    safeShowAuth(false);

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (activeView !== "dashboard") return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(redrawCharts, 150);
    });
  } catch (e) {
    safeShowAuth(true, `Erreur init: ${e?.message || e}`);
  }
};