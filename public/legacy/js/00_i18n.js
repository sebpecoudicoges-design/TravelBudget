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
      "app.reload_hint": "Astuce : un refresh applique tout.",

      // Navigation
      "nav.dashboard": "Tableau",
      "nav.transactions": "Transactions",
      "nav.settings": "Settings",
      "nav.trip": "Trip",
      "nav.members": "Membres",

      // Onboarding
      "onboarding.title": "Démarrer en 1 minute",
      "onboarding.step.wallet": "1) Crée un <b>wallet</b> (ex : Cash THB).",
      "onboarding.step.period": "2) Vérifie tes <b>périodes</b> (dates + budget/j).",
      "onboarding.step.tx": "3) Ajoute une transaction (ex : <i>Déjeuner 120 THB</i>).",
      "onboarding.tip": "Besoin d’aide ? Clique sur <b>?</b>.",

      // Wallet empty state
      "wallet.empty.title": "Aucun wallet.",
      "wallet.empty.body": "Crée au moins 1 wallet pour suivre ton solde (ex : Cash THB, Banque EUR).",

      // Transaction modal tooltips (microcopy)
      "tx.help.type": "Type = impact. Dépense ↓ / Revenu ↑.",
      "tx.help.wallet": "Choisis la poche (cash, banque…).",
      "tx.help.category": "Catégorie = lecture. Reste simple.",
      "tx.help.paid": "Payé maintenant = l’argent a bougé.",
      "tx.help.oob": "Hors budget/j : n’impacte pas l’objectif quotidien.",

      // Help / FAQ
      "nav.help": "Aide",
      "help.title": "Aide & FAQ",
      "help.subtitle": "Réponses rapides + actions.",
      "help.search_label": "Rechercher dans la FAQ",
      "help.search_placeholder": "Ex: change, wallet, à payer…",
      "help.no_results": "Aucun résultat. Essaie d’autres mots.",
      "help.top_results": "Résultats",
      "help.open_faq": "Ouvrir la FAQ",
      "help.guides.title": "Guides rapides",
      "help.action.open_settings": "Ouvrir Settings",
      "help.action.open_dashboard": "Ouvrir Dashboard",
      "help.action.open_trip": "Ouvrir Trip",
      "help.guide.create_trip.title": "Créer ton voyage",
      "help.guide.create_trip.body": "Settings → Voyage : dates, puis périodes.",
      "help.guide.create_periods.title": "Créer / ajuster tes périodes",
      "help.guide.create_periods.body": "Ajoute/ajuste. L’app évite trous et chevauchements.",
      "help.guide.fx.title": "FX : auto ECB vs manuel",
      "help.guide.fx.body": "Par défaut : auto ECB. Sinon : taux manuel daté.",
      "help.guide.wallets.title": "Wallets : cash / banque",
      "help.guide.wallets.body": "1 wallet par poche (cash/banque).",
      "help.guide.trip.title": "Trip : partager les dépenses",
      "help.guide.trip.body": "Trip : membres + dépenses (V1 : parts égales).",

      // Assistant
      "assistant.title": "Assistant",
      "assistant.context_title": "Contexte",
      "assistant.placeholder": "Pose une question… (ex: “Pourquoi la courbe baisse ?”)",
      "assistant.send": "Envoyer",
      "assistant.hint": "Je cherche une réponse…",
      "assistant.no_match": "Je n’ai pas trouvé de réponse exacte. Essaie avec d’autres mots clés.",
      "assistant.suggest_faq": "Voir la FAQ",
      "assistant.close": "Fermer",
      "assistant.minimize": "Réduire",

      "assistant.action.settings": "Settings",
      "assistant.action.wallets": "Wallets",
      "assistant.action.help": "Aide",
      "assistant.action.transactions": "Transactions",

      "assistant.intent.wallet_create": "Ajouter une wallet :\n• Dashboard → Wallets\n• + Wallet\n• Devise (ex: LAK) → Enregistrer",
      "assistant.intent.voyage_rename": "Renommer :\n• Settings → Voyage\n• Nom du voyage → modifier",

      // KPI
      "kpi.fxcalc.title": "Convertisseur",

      // Settings tooltips (Voyage / Périodes / FX)
      "settings.title": "Voyage",
      "settings.help.trip_dates": "Les dates du voyage se synchronisent avec la 1ère et la dernière période (dans les deux sens).",
      "settings.help.period_name": "Nom simple (ex: Asie 2026). Si non stockable en DB, c’est local au navigateur.",
      "settings.help.segments": "Périodes = phases : dates + budget/j + devise.",
      "settings.help.fx": "Change : ECB auto. Si absent : taux manuel daté.",

      // Dashboard tooltips
      "dashboard.help.scope": "Filtre = KPIs + courbe (segment, période, ou dates).",

      // Guides
      "help.guide.dashboard_scope.title": "Dashboard : filtrer KPIs / courbe",
      "help.guide.dashboard_scope.body": "Choisis un filtre en haut : KPIs + courbe suivent.",
      "help.guide.rename_voyage.title": "Renommer le voyage",
      "help.guide.rename_voyage.body": "Settings → Voyage : champ Nom.",
    },
    en: {
      // Generic
      "app.lang": "Language",
      "app.lang_fr": "Français",
      "app.lang_en": "English",
      "app.reload_hint": "Tip: refresh applies everything.",

      // Navigation
      "nav.dashboard": "Dashboard",
      "nav.transactions": "Transactions",
      "nav.settings": "Settings",
      "nav.trip": "Trip",
      "nav.members": "Members",

      // Onboarding
      "onboarding.title": "Get started in 1 minute",
      "onboarding.step.wallet": "1) Create a <b>wallet</b> (e.g., Cash THB).",
      "onboarding.step.period": "2) Check your <b>periods</b> (dates + daily budget).",
      "onboarding.step.tx": "3) Add a transaction (e.g., <i>Lunch 120 THB</i>).",
      "onboarding.tip": "Need help? Click <b>?</b>.",

      // Wallet empty state
      "wallet.empty.title": "No wallets yet.",
      "wallet.empty.body": "Create at least one wallet to track your balance (e.g., Cash THB, Bank EUR).",

      // Transaction modal tooltips
      "tx.help.type": "Type = impact. Expense ↓ / Income ↑.",
      "tx.help.wallet": "Pick the pocket (cash, bank…).",
      "tx.help.category": "Category = reading. Keep it simple.",
      "tx.help.paid": "Paid now = money moved.",
      "tx.help.oob": "Out of daily budget: does not change the daily target.",

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
      "help.action.open_settings": "Open Settings",
      "help.action.open_dashboard": "Open Dashboard",
      "help.action.open_trip": "Open Trip",
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
      "assistant.context_title": "Context",
      "assistant.placeholder": "Ask a question… (e.g., “Why is my curve going down?”)",
      "assistant.send": "Send",
      "assistant.hint": "Searching…",
      "assistant.no_match": "I didn’t find an exact match. Try different keywords.",
      "assistant.suggest_faq": "See FAQ",
      "assistant.close": "Close",
      "assistant.minimize": "Minimize",

      "assistant.action.settings": "Settings",
      "assistant.action.wallets": "Wallets",
      "assistant.action.help": "Help",
      "assistant.action.transactions": "Transactions",

      "assistant.intent.wallet_create": "Add a wallet:\n• Dashboard → Wallets\n• + Wallet\n• Currency (e.g., LAK) → Save",
      "assistant.intent.voyage_rename": "Rename:\n• Settings → Trip\n• Name field → edit",

      // KPI
      "kpi.fxcalc.title": "Converter",

      // Settings tooltips
      "settings.title": "Trip",
      "settings.help.trip_dates": "Trip dates are synced with the first and last period (both ways).",
      "settings.help.period_name": "Simple name (e.g., Asia 2026). If not in DB, it’s local to this browser.",
      "settings.help.segments": "Periods = phases: dates + daily budget + currency.",
      "settings.help.fx": "FX: ECB auto. If missing: dated manual rate.",

      // Dashboard tooltips
      "dashboard.help.scope": "Filter = KPIs + curve (segment, period, or dates).",

      // Guides
      "help.guide.dashboard_scope.title": "Dashboard: filter KPIs / curve",
      "help.guide.dashboard_scope.body": "Pick a filter at the top: KPIs + curve follow.",
      "help.guide.rename_voyage.title": "Rename the trip",
      "help.guide.rename_voyage.body": "Settings → Trip: Name field.",
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
  // Apply i18n to initial static DOM (legacy views may render later; tbSetLang reruns this)
  try { applyDom(); } catch (_) {}
})();
