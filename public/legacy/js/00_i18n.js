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
    },


// Help / FAQ
"nav.help": "Aide",
"help.title": "Aide & FAQ",
"help.subtitle": "Réponses rapides, exemples concrets, et mini-assistant.",
"help.search_label": "Rechercher dans la FAQ",
"help.search_placeholder": "Ex: taux de change, hors budget, à payer…",
"help.no_results": "Aucun résultat. Essaie avec d’autres mots (ex: "budget", "courbe", "devise").",
"help.top_results": "Résultats",
"help.open_faq": "Ouvrir la FAQ",
"assistant.title": "Assistant",
"assistant.placeholder": "Pose une question… (ex: “Pourquoi ma courbe baisse ?”)",
"assistant.send": "Envoyer",
"assistant.hint": "Je cherche dans la FAQ et te propose la meilleure réponse.",
"assistant.no_match": "Je n’ai pas trouvé de réponse exacte. Essaie avec d’autres mots clés.",
"assistant.suggest_faq": "Voir la FAQ",
"assistant.close": "Fermer",
"assistant.minimize": "Réduire",
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
