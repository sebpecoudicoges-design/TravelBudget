/* =========================
   Theme
   ========================= */
function applyTheme(theme) {
  const body = document.body;
  body.classList.remove("theme-light", "theme-dark");
  body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  localStorage.setItem(THEME_KEY, theme);
  // Redraw charts + cashflow curve on theme change so colors/contrast update immediately.
  if (typeof tbRequestRedrawCharts === "function") tbRequestRedrawCharts("04_theme.js"); else redrawCharts();
  try {
    if (typeof window.tbRequestCashflowCurveRender === "function") window.tbRequestCashflowCurveRender("theme");
    else if (typeof window.renderCashflowChart === "function") window.renderCashflowChart();
  } catch (_) {}
  try {
    if ((typeof activeView === 'string' ? activeView : '') === 'analysis') {
      if (typeof window.tbRequestAnalysisRender === 'function') window.tbRequestAnalysisRender('theme');
      else if (typeof window.renderBudgetAnalysis === 'function') window.renderBudgetAnalysis();
    }
  } catch (_) {}
}
function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || "light";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  if (sbUser) saveThemeToServer(next).catch(() => {});
}
async function saveThemeToServer(theme) {
  await sb.from(TB_CONST.TABLES.settings).update({ theme, updated_at: new Date().toISOString() }).eq("user_id", sbUser.id);
}

