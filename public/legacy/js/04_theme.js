/* =========================
   Theme
   ========================= */
function applyTheme(theme) {
  const body = document.body;
  body.classList.remove("theme-light", "theme-dark");
  body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  localStorage.setItem(THEME_KEY, theme);
  redrawCharts();
}
function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || "light";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  if (sbUser) saveThemeToServer(next).catch(() => {});
}
async function saveThemeToServer(theme) {
  await sb.from("settings").update({ theme, updated_at: new Date().toISOString() }).eq("user_id", sbUser.id);
}

