/* =========================
   i18n (V1)
   - Minimal translation layer for legacy UI strings
   - Default language: fr
   - Storage key: tb_lang_v1
   ========================= */

(function () {
  const LANG_KEY = "tb_lang_v1";

  const DICTS = {
    fr: {
      // Generic
      "app.lang": "Langue",
      "app.lang_fr": "Français",
      "app.lang_en": "English",
      "app.reload_hint": "Astuce : recharger la page applique tout immédiatement.",

      // Onboarding
      "onboarding.title": "Démarrer en 1 minute",
      "onboarding.step.wallet": "1) Crée un <b>wallet</b> (ex : Cash THB).",
      "onboarding.step.period": "2) Configure ta <b>période</b> et ta devise principale.",
      "onboarding.step.tx": "3) Ajoute une première transaction (ex : <i>Déjeuner 120 THB</i>).",
      "onboarding.tip": "Astuce : sur chaque champ sensible, clique sur le <b>?</b> pour une explication.",

      // Wallet empty state
      "wallet.empty.title": "Aucun wallet.",
      "wallet.empty.body": "Crée au moins 1 wallet pour suivre ton solde (ex : Cash THB, Banque EUR).",

      // Transaction modal tooltips (microcopy)
      "tx.help.type": "Le type définit l’impact budget. Exemple : Dépense = diminue ton budget, Revenu = augmente.",
      "tx.help.wallet": "Choisis le wallet impacté (cash, banque…).",
      "tx.help.category": "Une catégorie sert à lire tes dépenses. Garde-la simple.",
      "tx.help.paid": "Payé maintenant = l’argent est déjà sorti/entré du wallet.",
      "tx.help.oob": "Hors budget/jour : n’affecte pas l’objectif quotidien (ex : dépôt, transfert, achat exceptionnel).",

      // Help / FAQ
      "nav.help": "Aide",
      "help.title": "Aide & FAQ",
      "help.subtitle": "Réponses rapides, exemples concrets, et mini-assistant.",
      "help.search_label": "Rechercher dans la FAQ",
      "help.search_placeholder": "Ex: taux de change, hors budget, à payer…",
      "help.no_results": "Aucun résultat. Essaie avec d’autres mots (ex: budget, courbe, devise).",
      "help.top_results": "Résultats",
      "help.open_faq": "Ouvrir la FAQ",
      "help.guides.title": "Guides rapides",
      "help.guide.create_trip.title": "Créer ton voyage",
      "help.guide.create_trip.body": "Va dans <b>Settings → Voyage</b>, définis les dates, puis crée tes périodes (segments).",
      "help.guide.create_periods.title": "Créer / ajuster tes périodes",
      "help.guide.create_periods.body": "Ajoute une période, puis ajuste début/fin. Zéro overlap et zéro trou : l’app recale automatiquement.",
      "help.guide.fx.title": "FX : auto ECB vs manuel",
      "help.guide.fx.body": "Par défaut : <b>Auto ECB</b>. Si une devise n’est pas fournie par l’ECB, un <b>fallback manuel</b> daté est requis.",
      "help.guide.wallets.title": "Wallets : cash / banque",
      "help.guide.wallets.body": "Crée un wallet par <i>poche</i> (Cash, Banque). Le solde affiché = base + transactions payées.",
      "help.guide.trip.title": "Trip : partager les dépenses",
      "help.guide.trip.body": "Crée un trip, ajoute les membres, puis les dépenses. Les parts se calculent (V1) à parts égales.",

      // Assistant
      "assistant.title": "Assistant",
      "assistant.placeholder": "Pose une question… (ex: “Pourquoi ma courbe baisse ?”) ",
      "assistant.send": "Envoyer",
      "assistant.hint": "Je cherche dans la FAQ et te propose la meilleure réponse.",
      "assistant.no_match": "Je n’ai pas trouvé de réponse exacte. Essaie avec d’autres mots clés.",
      "assistant.suggest_faq": "Voir la FAQ",
      "assistant.close": "Fermer",
      "assistant.minimize": "Réduire",

      // Settings tooltips (Voyage / Périodes / FX)
      "settings.title": "Voyage",
      "settings.help.trip_dates": "Les dates du voyage se synchronisent avec la 1ère et la dernière période (dans les deux sens).",
      "settings.help.segments": "Les périodes (segments) définissent tes phases de voyage : dates + budget/j + devise base.",
      "settings.help.fx": "FX Option A : ECB auto prioritaire. Le manuel est un fallback daté, demandé uniquement si nécessaire.",
    },
    en: {
      // Generic
      "app.lang": "Language",
      "app.lang_fr": "Français",
      "app.lang_en": "English",
      "app.reload_hint": "Tip: reloading applies everything immediately.",

      // Onboarding
      "onboarding.title": "Get started in 1 minute",
      "onboarding.step.wallet": "1) Create a <b>wallet</b> (e.g., Cash THB).",
      "onboarding.step.period": "2) Set up your <b>period</b> and main currency.",
      "onboarding.step.tx": "3) Add your first transaction (e.g., <i>Lunch 120 THB</i>).",
      "onboarding.tip": "Tip: on sensitive fields, click the <b>?</b> for a quick explanation.",

      // Wallet empty state
      "wallet.empty.title": "No wallets yet.",
      "wallet.empty.body": "Create at least one wallet to track your balance (e.g., Cash THB, Bank EUR).",

      // Transaction modal tooltips
      "tx.help.type": "Type controls budget impact. Example: Expense decreases budget, Income increases it.",
      "tx.help.wallet": "Pick the wallet impacted (cash, bank…).",
      "tx.help.category": "Categories help you read your spending. Keep it simple.",
      "tx.help.paid": "Paid now = money already left/entered the wallet.",
      "tx.help.oob": "Out of daily budget: does not affect the daily objective (e.g., deposit, transfer, exceptional purchase).",

      // Help / FAQ
      "nav.help": "Help",
      "help.title": "Help & FAQ",
      "help.subtitle": "Quick answers, concrete examples, and a mini-assistant.",
      "help.search_label": "Search the FAQ",
      "help.search_placeholder": "e.g., exchange rate, out of budget, to pay…",
      "help.no_results": "No results. Try different keywords (e.g., budget, curve, currency).",
      "help.top_results": "Results",
      "help.open_faq": "Open FAQ",
      "help.guides.title": "Quick guides",
      "help.guide.create_trip.title": "Create your trip",
      "help.guide.create_trip.body": "Go to <b>Settings → Trip</b>, set dates, then create your periods (segments).",
      "help.guide.create_periods.title": "Create / adjust periods",
      "help.guide.create_periods.body": "Add a period, then adjust start/end. No overlaps and no gaps: the app re-aligns automatically.",
      "help.guide.fx.title": "FX: ECB auto vs manual",
      "help.guide.fx.body": "Default: <b>ECB auto</b>. If a currency is not provided by ECB, a dated <b>manual fallback</b> is required.",
      "help.guide.wallets.title": "Wallets: cash / bank",
      "help.guide.wallets.body": "Create one wallet per <i>pocket</i> (Cash, Bank). Displayed balance = base + paid transactions.",
      "help.guide.trip.title": "Trip: split expenses",
      "help.guide.trip.body": "Create a trip, add members, then expenses. Shares are computed (V1) equally.",

      // Assistant
      "assistant.title": "Assistant",
      "assistant.placeholder": "Ask a question… (e.g., “Why is my curve going down?”)",
      "assistant.send": "Send",
      "assistant.hint": "I search the FAQ and suggest the best answer.",
      "assistant.no_match": "I didn’t find an exact match. Try different keywords.",
      "assistant.suggest_faq": "See FAQ",
      "assistant.close": "Close",
      "assistant.minimize": "Minimize",

      // Settings tooltips
      "settings.title": "Trip",
      "settings.help.trip_dates": "Trip dates are synced with the first and last period (both ways).",
      "settings.help.segments": "Periods (segments) define your trip phases: dates + daily budget + base currency.",
      "settings.help.fx": "FX Option A: ECB auto is authoritative. Manual is a dated fallback, requested only when needed.",
    }
  };

  function getLang() {
    const forced = (window.TB_LANG_FORCE || "").trim();
    if (forced && DICTS[forced]) return forced;
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && DICTS[stored]) return stored;
    } catch (_) {}
    return "fr";
  }

  function setLang(lang) {
    if (!DICTS[lang]) return;
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
    window.TB_LANG = lang;
  }

  function t(key, vars) {
    const lang = getLang();
    const dict = DICTS[lang] || DICTS.fr;
    let s = dict[key] || DICTS.fr[key] || key;
    if (vars && typeof vars === "object") {
      Object.keys(vars).forEach((k) => {
        s = s.replaceAll("{" + k + "}", String(vars[k]));
      });
    }
    return s;
  }

  // Optional: apply translations to static DOM nodes
  function applyDom(rootEl) {
    const root = rootEl || document;
    const nodes = root.querySelectorAll("[data-t]");
    nodes.forEach((el) => {
      const k = el.getAttribute("data-t");
      if (!k) return;
      // Allow HTML in some nodes
      if (el.getAttribute("data-t-html") === "1") el.innerHTML = t(k);
      else el.textContent = t(k);
    });
  }

  window.TB_I18N = DICTS;
  
  function applyLangSwitchUI() {
    try {
      const lang = getLang();
      const fr = document.getElementById("tbLangFr");
      const en = document.getElementById("tbLangEn");
      if (fr) fr.classList.toggle("is-active", lang === "fr");
      if (en) en.classList.toggle("is-active", lang === "en");
    } catch (_) {}
  }

  function bindLangSwitch() {
    try {
      const fr = document.getElementById("tbLangFr");
      const en = document.getElementById("tbLangEn");
      if (fr && !fr.__tbBound) {
        fr.__tbBound = true;
        fr.addEventListener("click", () => window.tbSetLang && window.tbSetLang("fr"));
      }
      if (en && !en.__tbBound) {
        en.__tbBound = true;
        en.addEventListener("click", () => window.tbSetLang && window.tbSetLang("en"));
      }
    } catch (_) {}
  }

  window.TB_LANG = getLang();
  window.tbT = t;
  window.tbOnLangChange = window.tbOnLangChange || [];

  window.tbSetLang = function (lang) {
    setLang(lang);
    // Re-render: safest approach in this legacy app
    try { if (typeof refreshAll === "function") refreshAll(); } catch (_) {}
    try { if (typeof renderAll === "function") renderAll(); } catch (_) {}
    try { applyDom(); } catch (_) {}
    try { bindLangSwitch(); } catch (_) {}
    try { applyLangSwitchUI(); } catch (_) {}
  };
  window.tbGetLang = getLang;
  window.tbApplyI18nDom = applyDom;
  // Bind global language switch (if present)
  try { bindLangSwitch(); } catch (_) {}
  try { applyLangSwitchUI(); } catch (_) {}
})();
