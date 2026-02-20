/* =========================
   Boot
   ========================= */
window.onload = async function () {
  // theme (local first)
  applyTheme(localStorage.getItem(THEME_KEY) || "light");

  // palette (local preview first, server will override after login)
  const storedPalette = getStoredPalette() || PALETTES["Ocean"];
  const storedPreset = getStoredPreset() || findPresetNameForPalette(storedPalette);
  await applyPalette(storedPalette, storedPreset, { persistLocal: true, persistRemote: false });

  sb.auth.onAuthStateChange((_event, session) => {
    sbUser = session?.user || null;
    if (!sbUser) showAuth(true, "Session expirée. Reconnecte-toi.");
  });

  const { data, error } = await sb.auth.getSession();
  if (error) { showAuth(true, error.message); return; }

  sbUser = data.session?.user || null;

  if (!sbUser) {
    showAuth(true, "Connecte-toi pour synchroniser.");
    return;
  }

  try {
    await ensureBootstrap();
    await refreshFromServer(); // -> loadFromSupabase applies server palette + preset
    showAuth(false);
    showView("dashboard");

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (activeView !== "dashboard") return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(redrawCharts, 150);
    });
  } catch (e) {
    showAuth(true, `Erreur init: ${e?.message || e}`);
  }
};
