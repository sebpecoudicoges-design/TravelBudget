(() => {
  const lang = () => document.documentElement.lang === "en" ? "en" : "fr";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
  function bindProjectTheme() {
    const theme = window.tbProjectTheme;
    if (!theme) return;
    const buttons = [...document.querySelectorAll("[data-project-theme]")];
    const refresh = () => {
      const preference = document.documentElement.dataset.theme || "system";
      buttons.forEach((button) => {
        const active = button.dataset.projectTheme === preference;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };
    buttons.forEach((button) => button.addEventListener("click", () => {
      const preference = button.dataset.projectTheme || "system";
      try { localStorage.setItem(theme.key, preference); } catch (_) { /* keep the in-page choice functional */ }
      theme.apply(preference);
      refresh();
    }));
    const syncSystemTheme = () => {
      if ((document.documentElement.dataset.theme || "system") === "system") theme.apply("system");
    };
    if (theme.darkMedia.addEventListener) theme.darkMedia.addEventListener("change", syncSystemTheme);
    else theme.darkMedia.addListener?.(syncSystemTheme);
    refresh();
  }

  function releaseFamily(text) {
    const value = text.toLowerCase();
    if (/(sport|timer|workout|seance|séance)/.test(value)) return lang() === "fr" ? "Sport" : "Sport";
    if (/(nutrition|meal|repas|alimentation)/.test(value)) return lang() === "fr" ? "Nutrition" : "Nutrition";
    if (/(trip|split|participant)/.test(value)) return "Trip";
    if (/(performance|chunk|bundle|boot|legacy)/.test(value)) return "Performance";
    if (/(settings|reglages|réglages)/.test(value)) return "Settings";
    return lang() === "fr" ? "Produit" : "Product";
  }

  function renderReleasePulse() {
    const host = document.getElementById("releasePulseGrid");
    if (!host) return;
    const rows = [...document.querySelectorAll("#releaseSource .release-row")].slice(0, 5);
    const locale = lang();
    host.innerHTML = rows.map((row) => {
      const version = row.querySelector("strong")?.textContent?.trim() || "";
      const date = row.dataset.releaseDate;
      const label = date ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
      }).format(new Date(`${date}T00:00:00Z`)) : version;
      const text = row.querySelector("span")?.textContent?.trim() || "";
      const family = releaseFamily(text);
      const title = text.includes(":") ? text.split(":")[0] : family;
      const summary = text.length > 155 ? `${text.slice(0, 152).trim()}…` : text;
      const proof = /test/i.test(text) ? (locale === "fr" ? "Tests couverts" : "Tests covered") : /kib|bundle|chunk/i.test(text) ? (locale === "fr" ? "Poids mesure" : "Size measured") : (locale === "fr" ? "Version tracee" : "Version traced");
      return `<article class="release-pulse-card"><small>${esc(label)} · ${esc(family)}</small><h4>${esc(title)}</h4><p>${esc(summary)}</p><span class="release-pulse-proof">${esc(proof)}</span></article>`;
    }).join("");
  }

  function connectTrustLinks() {
    const source = document.querySelector('a[href*="app-downloads/apk"]');
    const target = document.getElementById("trustApkLink");
    if (source && target) target.href = source.href;
    const deleteLink = document.querySelector('[data-i18n="trusthub.deleteaction"]');
    if (deleteLink) deleteLink.href = `/privacy.html#${lang() === "fr" ? "fr-suppression" : "en-deletion"}`;
  }

  function renderAll() {
    renderReleasePulse();
    connectTrustLinks();
  }

  let previousLanguage = lang();
  new MutationObserver(() => {
    const nextLanguage = lang();
    if (nextLanguage !== previousLanguage) {
      previousLanguage = nextLanguage;
      renderAll();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  bindProjectTheme();
  renderAll();
})();
