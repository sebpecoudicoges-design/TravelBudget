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
      "nav.trip": "Partage",
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
      "help.subtitle": "Aide alignée V9.7 : budget, wallets, analyse, documents, patrimoine, récurrences et partage.",
      "help.search_label": "Rechercher dans la FAQ",
      "help.search_placeholder": "Ex : documents expirés, patrimoine, récurrence, budget sourcé…",
      "help.no_results": "Aucun résultat. Essaie avec : budget, wallet, analyse, documents, patrimoine, récurrence, partage.",
      "help.top_results": "Résultats",
      "help.open_faq": "Ouvrir la FAQ",
      "help.guides.title": "Guides rapides",
      "help.action.open_settings": "Ouvrir Settings",
      "help.action.open_dashboard": "Ouvrir Dashboard",
      "help.action.open_trip": "Ouvrir Partage",
      "help.quick_start.title": "Démarrage rapide",
      "help.quick_start.body": "L’app est plus fiable si tu configures d’abord la base, puis les modules avancés.",
      "help.quick_start.periods": "Vérifier le voyage, les périodes et le budget",
      "help.quick_start.wallets": "Créer au moins une wallet",
      "help.quick_start.transactions": "Saisir une première transaction",
      "help.quick_start.trip": "Utiliser Partage si tu dépenses à plusieurs",
      "help.quick_start.documents": "Ajouter tes documents importants",
      "help.quick_start.assets": "Ajouter tes biens dans Patrimoine",
      "help.guide.create_trip.title": "Créer ton voyage",
      "help.guide.create_trip.body": "Settings → Voyage : règle les dates, puis ajuste les périodes.",
      "help.guide.create_periods.title": "Créer / ajuster tes périodes",
      "help.guide.create_periods.body": "Ajoute ou ajuste les périodes. L’app garde une chronologie propre.",
      "help.guide.fx.title": "FX: auto vs manual rate",
      "help.guide.fx.body": "L’app privilégie le taux automatique daté. Saisis un taux manuel seulement si nécessaire.",
      "help.guide.wallets.title": "Wallets : cash / banque",
      "help.guide.wallets.body": "1 wallet par poche réelle : cash, banque, carte. Le solde suit les transactions payées.",
      "help.guide.trip.title": "Partage : partager les dépenses",
      "help.guide.trip.body": "Ajoute les membres, le payeur et les participants. L’app calcule balances et remboursements.",
      "help.guide.transactions.title": "Transactions : dates et statut",
      "help.guide.transactions.body": "Distingue date de paiement, date budget, payé maintenant, à payer et hors budget.",
      "help.guide.analysis.title": "Analyse : réel vs budget sourcé",
      "help.guide.analysis.body": "Compare tes dépenses réelles au budget de référence, avec catégories et sous-catégories mappées.",
      "help.guide.recurring.title": "Échéances périodiques",
      "help.guide.recurring.body": "Crée les revenus ou dépenses répétitives : salaire, abonnements, loyer, assurance.",
      "help.guide.documents.title": "Documents",
      "help.guide.documents.body": "Classe passeport, visa, assurance ou billets avec dossiers, tags, favoris et dates d’expiration.",
      "help.guide.assets.title": "Patrimoine",
      "help.guide.assets.body": "Suis les biens importants : valeur, amortissement, copropriétaires, achat, vente et transferts.",

      // Assistant
      "assistant.title": "Assistant",
      "assistant.context_title": "Contexte",
      "assistant.placeholder": "Pose une question… ex : documents expirés, patrimoine, récurrence, budget sourcé",
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
      "assistant.action.analysis": "Analyse",
      "assistant.action.documents": "Documents",
      "assistant.action.assets": "Patrimoine",
      "assistant.action.trip": "Partage",

      "assistant.intent.wallet_create": "Ajouter une wallet :\n• Dashboard → Wallets\n• + Wallet\n• Devise (ex: LAK) → Enregistrer",
      "assistant.intent.voyage_rename": "Renommer :\n• Settings → Voyage\n• Nom du voyage → modifier",
      "assistant.intent.documents": "Documents :\n• Ouvre Documents\n• Ajoute passeport, visa, assurance ou billet\n• Renseigne dossier, tags, favori et date d’expiration\n• À prévoir : Renouvellement requis Oui/Non",
      "assistant.intent.assets": "Patrimoine :\n• Ouvre Patrimoine\n• Ajoute un bien avec valeur d’achat et valeur estimée\n• Ajoute les copropriétaires si besoin\n• Crée une transaction seulement si du cash bouge réellement",
      "assistant.intent.analysis": "Analyse :\n• Ouvre Analyse\n• Vérifie le filtre période/devise\n• Compare réel, budget sourcé, dépenses payées/à payer et budget restant\n• Vérifie le mapping catégorie/sous-catégorie si un écart semble faux",
      "assistant.intent.recurring": "Échéances périodiques :\n• Settings → Échéances\n• Crée une règle pour salaire, abonnement, loyer ou assurance\n• Les transactions générées restent traçables",
      "assistant.intent.trip": "Partage :\n• Ouvre Partage\n• Ajoute les membres\n• Choisis le payeur et les participants\n• L’app calcule balances et remboursements",
      "assistant.context.trip": "Voyage",
      "assistant.context.period": "Période",
      "assistant.context.modules": "Modules",
      "assistant.context.fx_ok": "Taux à jour",
      "assistant.context.fx_stale": "Mise à jour recommandée",
      "assistant.context.fx_missing": "Taux indisponible",

      // KPI
      "kpi.fxcalc.title": "Convertisseur",

      // Settings tooltips (Voyage / Périodes / FX)
      "settings.title": "Voyage",
      "settings.help.trip_dates": "Les dates du voyage se synchronisent avec la 1ère et la dernière période (dans les deux sens).",
      "settings.help.period_name": "Nom simple (ex: Asie 2026). Si non stockable en DB, c’est local au navigateur.",
      "settings.help.segments": "Chaque période porte ses dates, sa devise et son budget/jour.",
      "settings.help.fx": "Taux automatique si disponible. Sinon, tu peux saisir un taux perso.",

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
      "nav.trip": "Partage",
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
      "help.subtitle": "V9.7-aligned help: budget, wallets, analysis, documents, assets, recurring rules and split expenses.",
      "help.search_label": "Search the FAQ",
      "help.search_placeholder": "e.g., expired documents, assets, recurring rules, reference budget…",
      "help.no_results": "No results. Try: budget, wallet, analysis, documents, assets, recurring, split.",
      "help.top_results": "Results",
      "help.open_faq": "Open FAQ",
      "help.guides.title": "Quick guides",
      "help.action.open_settings": "Open Settings",
      "help.action.open_dashboard": "Open Dashboard",
      "help.action.open_trip": "Open Split",
      "help.quick_start.title": "Quick start",
      "help.quick_start.body": "The app is more reliable when you configure the base first, then advanced modules.",
      "help.quick_start.periods": "Check trip, periods and budget",
      "help.quick_start.wallets": "Create at least one wallet",
      "help.quick_start.transactions": "Add a first transaction",
      "help.quick_start.trip": "Use Split if you spend with others",
      "help.quick_start.documents": "Add important documents",
      "help.quick_start.assets": "Add assets",
      "help.guide.create_trip.title": "Create your trip",
      "help.guide.create_trip.body": "Go to <b>Settings → Trip</b>, set the dates, then adjust your periods.",
      "help.guide.create_periods.title": "Create / adjust periods",
      "help.guide.create_periods.body": "Add or adjust periods. The app keeps the timeline clean.",
      "help.guide.fx.title": "Taux auto vs taux perso",
      "help.guide.fx.body": "The app prioritizes dated automatic rates. Enter a manual rate only when needed.",
      "help.guide.wallets.title": "Wallets: cash / bank",
      "help.guide.wallets.body": "Create one wallet per <i>pocket</i> (Cash, Bank). Displayed balance = base + paid transactions.",
      "help.guide.trip.title": "Trip: split expenses",
      "help.guide.trip.body": "Add members, payer and participants. The app computes balances and settlement suggestions.",
      "help.guide.transactions.title": "Transactions: dates and status",
      "help.guide.transactions.body": "Separate payment date, budget date, paid now, pending and out-of-budget items.",
      "help.guide.analysis.title": "Analysis: actual vs reference budget",
      "help.guide.analysis.body": "Compare actual spending to the reference budget, with mapped categories and subcategories.",
      "help.guide.recurring.title": "Recurring rules",
      "help.guide.recurring.body": "Create repeated income or expenses: salary, subscriptions, rent or insurance.",
      "help.guide.documents.title": "Documents",
      "help.guide.documents.body": "Organize passport, visa, insurance or tickets with folders, tags, favorites and expiry dates.",
      "help.guide.assets.title": "Assets",
      "help.guide.assets.body": "Track important assets: value, depreciation, co-owners, purchase, sale and transfers.",

      // Assistant
      "assistant.title": "Assistant",
      "assistant.context_title": "Context",
      "assistant.placeholder": "Ask a question… e.g., expired documents, assets, recurring rules, reference budget",
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
      "assistant.action.analysis": "Analysis",
      "assistant.action.documents": "Documents",
      "assistant.action.assets": "Assets",
      "assistant.action.trip": "Split",

      "assistant.intent.wallet_create": "Add a wallet:\n• Dashboard → Wallets\n• + Wallet\n• Currency (e.g., LAK) → Save",
      "assistant.intent.voyage_rename": "Rename:\n• Settings → Trip\n• Name field → edit",
      "assistant.intent.documents": "Documents:\n• Open Documents\n• Add passport, visa, insurance or ticket\n• Set folder, tags, favorite and expiry date\n• Recommended next step: Renewal required Yes/No",
      "assistant.intent.assets": "Assets:\n• Open Assets\n• Add an asset with purchase value and estimated value\n• Add co-owners if needed\n• Create a transaction only if cash actually moves",
      "assistant.intent.analysis": "Analysis:\n• Open Analysis\n• Check period/currency filter\n• Compare actuals, reference budget, paid/pending items and remaining budget\n• Check category/subcategory mapping if a delta looks wrong",
      "assistant.intent.recurring": "Recurring rules:\n• Settings → Recurring rules\n• Create a rule for salary, subscription, rent or insurance\n• Generated transactions remain traceable",
      "assistant.intent.trip": "Split:\n• Open Split\n• Add members\n• Choose payer and participants\n• The app computes balances and settlements",
      "assistant.context.trip": "Trip",
      "assistant.context.period": "Period",
      "assistant.context.modules": "Modules",
      "assistant.context.fx_ok": "Rates up to date",
      "assistant.context.fx_stale": "Update recommended",
      "assistant.context.fx_missing": "Rates unavailable",

      // KPI
      "kpi.fxcalc.title": "Converter",

      // Settings tooltips
      "settings.title": "Trip",
      "settings.help.trip_dates": "Trip dates are synced with the first and last period (both ways).",
      "settings.help.period_name": "Simple name (e.g., Asia 2026). If not in DB, it’s local to this browser.",
      "settings.help.segments": "Each period carries its dates, currency and daily budget.",
      "settings.help.fx": "Automatic rate when available. Otherwise, you can set a custom rate.",

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
