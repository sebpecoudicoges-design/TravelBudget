/* =========================
   Help / FAQ (V9.7.0.1)
   - Static FAQ entries (FR/EN)
   - Search helper for assistant
   - Quick guides for current modules
   ========================= */

(function () {
  const FAQ = [
    {
      id: "start_order",
      tags: ["démarrage", "start", "voyage", "wallet", "transaction", "settings"],
      q: { fr: "Dans quel ordre configurer l’app ?", en: "What is the best setup order?" },
      a: {
        fr: "Commence par <b>Settings → Voyage</b> pour les dates et périodes, crée ensuite tes <b>wallets</b>, puis ajoute les transactions. Ensuite seulement, affine l’analyse, les documents, le patrimoine et le partage.",
        en: "Start with <b>Settings → Trip</b> for dates and periods, then create your <b>wallets</b>, then add transactions. After that, refine analysis, documents, assets and split expenses."
      }
    },
    {
      id: "budget_daily",
      tags: ["budget", "journalier", "daily", "projection", "kpi"],
      q: { fr: "Comment fonctionne le budget journalier ?", en: "How does the daily budget work?" },
      a: {
        fr: "Le budget journalier vient de la période ou du budget source. Il sert à projeter ton solde futur et à mesurer le reste disponible. Les dépenses hors budget ne consomment pas cet objectif journalier.",
        en: "The daily budget comes from the period or reference budget. It projects future balance and measures what remains available. Out-of-budget expenses do not consume that daily target."
      }
    },
    {
      id: "budget_dates",
      tags: ["date", "budget", "paiement", "transaction", "réalité", "projection"],
      q: { fr: "Pourquoi distinguer date de paiement et date budget ?", en: "Why separate payment date and budget date?" },
      a: {
        fr: "La date de paiement dit quand l’argent bouge réellement. La date budget dit sur quels jours la dépense doit peser dans l’analyse. Exemple : un hôtel payé aujourd’hui peut couvrir plusieurs nuits futures.",
        en: "The payment date says when money actually moves. The budget date says which days the expense should affect in analysis. Example: a hotel paid today can cover several future nights."
      }
    },
    {
      id: "paid_pending",
      tags: ["payé", "à payer", "à recevoir", "cashflow", "wallet", "pending"],
      q: { fr: "“Payé maintenant” vs “À payer” : quelle différence ?", en: "“Paid now” vs “To pay”: what is the difference?" },
      a: {
        fr: "<b>Payé maintenant</b> modifie le solde wallet. <b>À payer / à recevoir</b> garde l’opération dans la projection mais ne change pas encore le cash réel.",
        en: "<b>Paid now</b> changes the wallet balance. <b>To pay / to receive</b> keeps the item in projection but does not change real cash yet."
      }
    },
    {
      id: "out_of_budget",
      tags: ["hors budget", "out of budget", "exceptionnel", "objectif"],
      q: { fr: "À quoi sert “Hors budget” ?", en: "What is “Out of budget” for?" },
      a: {
        fr: "Utilise-le pour une dépense réelle qui ne doit pas fausser ton objectif quotidien : dépôt, achat exceptionnel, avance, correction. Elle reste dans le réel mais pas dans la consommation du budget jour.",
        en: "Use it for a real expense that should not distort your daily target: deposit, one-off purchase, advance, correction. It remains in actuals but not in daily budget consumption."
      }
    },
    {
      id: "wallet_balance",
      tags: ["wallet", "solde", "balance", "cash", "banque", "ajuster"],
      q: { fr: "Pourquoi le solde wallet ne correspond pas exactement à ma banque ?", en: "Why does my wallet balance not exactly match my bank?" },
      a: {
        fr: "Le solde affiché dépend du solde de base, des transactions payées et des conversions. Si tu veux recaler sans casser l’historique, utilise <b>Ajuster solde</b> : l’app crée une transaction de correction propre.",
        en: "Displayed balance depends on base balance, paid transactions and conversions. To realign without breaking history, use <b>Adjust balance</b>: the app creates a clean correction transaction."
      }
    },
    {
      id: "fx_auto_manual",
      tags: ["fx", "taux", "devise", "auto", "manuel", "fallback", "ecb"],
      q: { fr: "Taux FX : automatique ou manuel ?", en: "FX rates: automatic or manual?" },
      a: {
        fr: "L’app privilégie le taux automatique daté. Si une devise n’est pas couverte ou si tu veux une référence précise, tu peux saisir un taux manuel. L’important est de savoir quel taux est utilisé pour l’analyse.",
        en: "The app prioritizes dated automatic rates. If a currency is not covered or you need a precise reference, you can enter a manual rate. The key is knowing which rate is used for analysis."
      }
    },
    {
      id: "periods",
      tags: ["période", "period", "dates", "devise", "budget", "overlap", "trou"],
      q: { fr: "À quoi servent les périodes ?", en: "What are periods for?" },
      a: {
        fr: "Une période porte des dates, une devise/base de lecture et un budget. Les périodes structurent le voyage : pas de chevauchement, pas de double comptage, et une analyse plus propre.",
        en: "A period carries dates, a reading/base currency and a budget. Periods structure the trip: no overlap, no double counting, cleaner analysis."
      }
    },
    {
      id: "reference_budget",
      tags: ["budget sourcé", "référence", "pays", "analyse", "recommandé"],
      q: { fr: "Budget sourcé : comment le lire ?", en: "How should I read the reference budget?" },
      a: {
        fr: "Le budget sourcé compare tes dépenses réelles à une base pays/style de voyage. Ce n’est pas une vérité absolue : c’est un repère pour comprendre où tu dépenses plus ou moins que prévu.",
        en: "The reference budget compares actual spending to a country/travel-style baseline. It is not absolute truth: it is a benchmark to see where you spend more or less than expected."
      }
    },
    {
      id: "analysis_mapping",
      tags: ["analyse", "mapping", "catégorie", "sous-catégorie", "budget", "réel"],
      q: { fr: "Pourquoi mapper les catégories analytiques ?", en: "Why map analytic categories?" },
      a: {
        fr: "Le mapping relie tes catégories personnalisées aux familles d’analyse : logement, repas, transport, activités, divers. Sans mapping clair, la comparaison réel vs budget sourcé devient moins fiable.",
        en: "Mapping links your custom categories to analysis families: accommodation, food, transport, activities, misc. Without clear mapping, actual vs reference comparison becomes less reliable."
      }
    },
    {
      id: "analysis_remaining_budget",
      tags: ["analyse", "budget restant", "projection", "solde", "prévu"],
      q: { fr: "Que signifie le budget restant dans l’analyse ?", en: "What does remaining budget mean in analysis?" },
      a: {
        fr: "C’est la part de budget non encore consommée sur la période filtrée. Elle aide à projeter le solde fin de période avec les dépenses déjà payées, à payer et le budget encore disponible.",
        en: "It is the unconsumed budget over the selected period. It helps project end-of-period balance with paid expenses, pending items and remaining budget."
      }
    },
    {
      id: "recurring_rules",
      tags: ["récurrence", "échéance", "mensuel", "salaire", "abonnement", "recurring"],
      q: { fr: "À quoi servent les échéances périodiques ?", en: "What are recurring rules for?" },
      a: {
        fr: "Elles servent aux revenus ou dépenses répétitives : salaire, abonnement, loyer, assurance. La règle génère des transactions traçables, que tu peux ensuite confirmer, détacher ou supprimer selon le cas.",
        en: "They handle repeated income or expenses: salary, subscription, rent, insurance. The rule generates traceable transactions that you can confirm, detach or delete depending on the case."
      }
    },
    {
      id: "documents",
      tags: ["documents", "papier", "passeport", "expiration", "dossier", "favori", "tag"],
      q: { fr: "À quoi sert le module Documents ?", en: "What is the Documents module for?" },
      a: {
        fr: "Il centralise tes documents utiles : passeport, visa, assurance, permis, billets, justificatifs. Tu peux classer par dossier, tags, favoris et surveiller les dates d’expiration.",
        en: "It centralizes useful documents: passport, visa, insurance, driving license, tickets, proofs. You can organize by folder, tags, favorites and monitor expiry dates."
      }
    },
    {
      id: "documents_expiry",
      tags: ["documents", "expiration", "renouvellement", "alerte", "renewal"],
      q: { fr: "Comment gérer les documents expirés ?", en: "How should expired documents be handled?" },
      a: {
        fr: "Aujourd’hui, l’app suit surtout la date d’expiration. Évolution recommandée : ajouter <b>Renouvellement requis Oui/Non</b>, pour éviter les alertes sur un document expiré mais non renouvelable.",
        en: "Today, the app mostly tracks expiry date. Recommended evolution: add <b>Renewal required Yes/No</b>, to avoid alerts for expired documents that do not need renewal."
      }
    },
    {
      id: "documents_share",
      tags: ["documents", "partage", "lien", "invite", "temporaire", "share"],
      q: { fr: "Le partage de document est-il permanent ?", en: "Is document sharing permanent?" },
      a: {
        fr: "Le partage doit rester temporaire et contrôlé. Utilise les liens uniquement pour transmettre un document précis, puis révoque ou laisse expirer l’accès quand ce n’est plus nécessaire.",
        en: "Sharing should remain temporary and controlled. Use links only for a specific document, then revoke or let access expire when it is no longer needed."
      }
    },
    {
      id: "assets",
      tags: ["patrimoine", "asset", "actif", "vente", "achat", "copropriétaire", "amortissement"],
      q: { fr: "À quoi sert le module Patrimoine ?", en: "What is the Assets module for?" },
      a: {
        fr: "Il suit les biens importants : valeur d’achat, valeur estimée, amortissement, copropriétaires, achats/ventes et transferts de parts. Il reste séparé du budget quotidien pour ne pas polluer l’analyse voyage.",
        en: "It tracks important assets: purchase value, estimated value, depreciation, co-owners, purchases/sales and ownership transfers. It stays separate from daily budget to avoid polluting trip analysis."
      }
    },
    {
      id: "assets_transactions",
      tags: ["patrimoine", "transaction", "cash", "wallet", "vente", "achat"],
      q: { fr: "Une opération patrimoine doit-elle créer une transaction ?", en: "Should an asset operation create a transaction?" },
      a: {
        fr: "Oui si l’argent bouge réellement dans un wallet. Non si tu modifies seulement une estimation de valeur. L’objectif est de garder le cash réel propre et l’historique patrimoine lisible.",
        en: "Yes if money actually moves in a wallet. No if you only update an estimated value. The goal is to keep real cash clean and asset history readable."
      }
    },
    {
      id: "trip_split",
      tags: ["partage", "split", "participant", "membre", "parts", "dépense"],
      q: { fr: "Comment fonctionne Partage ?", en: "How does Split work?" },
      a: {
        fr: "Partage sert aux dépenses entre plusieurs personnes. Tu ajoutes les membres, la dépense, qui a payé et qui participe. L’app calcule les balances et peut suggérer des remboursements.",
        en: "Split handles expenses between several people. Add members, the expense, who paid and who participates. The app computes balances and can suggest settlements."
      }
    },
    {
      id: "simple_advanced",
      tags: ["mode simple", "mode avancé", "advanced", "simple", "interface"],
      q: { fr: "Quand utiliser le mode simple ou avancé ?", en: "When should I use simple or advanced mode?" },
      a: {
        fr: "Le mode simple garde les écrans lisibles au quotidien. Le mode avancé sert quand tu dois régler finement les périodes, FX, analyse, récurrences, patrimoine ou mapping analytique.",
        en: "Simple mode keeps daily screens readable. Advanced mode is for precise control over periods, FX, analysis, recurring rules, assets or analytic mapping."
      }
    }
  ];

  function _lang() {
    try { return (window.tbGetLang && tbGetLang()) || "fr"; } catch (_) { return "fr"; }
  }

  function _norm(s) {
    try {
      return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    } catch (_) { return String(s || "").toLowerCase().trim(); }
  }

  function tbGetFaqEntries() { return FAQ.slice(); }

  function tbSearchFaq(query, limit) {
    const qn = _norm(query);
    if (!qn) return [];
    const tokens = qn.split(" ").filter(Boolean);
    const l = _lang();
    return FAQ.map(item => {
      const haystack = _norm([item.id, (item.q && item.q[l]) || "", (item.a && item.a[l]) || "", (item.tags || []).join(" ")].join(" "));
      let score = 0;
      tokens.forEach(tok => {
        if (!tok) return;
        if (haystack.includes(tok)) score += tok.length >= 5 ? 3 : 2;
        if ((item.tags || []).some(tag => _norm(tag) === tok)) score += 4;
      });
      return { item, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, Math.max(1, Number(limit) || 6)).map(x => x.item);
  }

  window.tbGetFaqEntries = tbGetFaqEntries;
  window.tbSearchFaq = tbSearchFaq;

  function _t(k){ return (window.tbT ? tbT(k) : k); }
  function _esc(s) {
    if (typeof window.escapeHTML === "function") return window.escapeHTML(s);
    return String(s || "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }

  function renderHelpFaq() {
    const root = document.getElementById("help-root");
    if (!root) return;
    try { if (window.tbApplyI18nDom) tbApplyI18nDom(root); } catch (_) {}

    const input = document.getElementById("help-search");
    if (input && !input.__tbBound) {
      input.__tbBound = true;
      input.addEventListener("input", () => doSearch());
    }
    if (input) input.placeholder = _t("help.search_placeholder");

    renderQuickSetup(root);
    renderGuides(root);

    const list = document.getElementById("help-list");
    if (list) list.innerHTML = FAQ.map(item => _renderFaqItem(item)).join("");
    doSearch(true);
  }

  function renderQuickSetup(root) {
    let setup = document.getElementById("help-quick-setup");
    if (!setup) {
      setup = document.createElement("div");
      setup.id = "help-quick-setup";
      setup.style.marginTop = "12px";
      setup.style.marginBottom = "12px";
      root.insertBefore(setup, root.firstChild);
    }
    const s = window.state || {};
    const wallets = Array.isArray(s.wallets) ? s.wallets : [];
    const txs = Array.isArray(s.transactions) ? s.transactions.filter(x => !x?.isInternal) : [];
    const trips = Array.isArray(s.trips) ? s.trips : [];
    const periods = Array.isArray(s.budgetSegments) ? s.budgetSegments : [];
    const docs = Array.isArray(s.documents) ? s.documents : [];
    const assets = Array.isArray(s.assets) ? s.assets : [];
    const row = (ok, label, view) => `<div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,0,0,.05);"><span>${ok ? "✅" : "⬜"} ${_esc(label)}</span><button class="btn" type="button" onclick="showView('${_esc(view)}')">${_esc(view === "trip" ? _t("help.action.open_trip") : view === "settings" ? _t("help.action.open_settings") : view === "dashboard" ? _t("help.action.open_dashboard") : view === "transactions" ? _t("assistant.action.transactions") : view === "analysis" ? _t("assistant.action.analysis") : view === "documents" ? _t("assistant.action.documents") : view === "assets" ? _t("assistant.action.assets") : view)}</button></div>`;
    setup.innerHTML = `
      <div class="hint" style="padding:12px; border:1px solid rgba(0,0,0,.08); border-radius:14px; background:rgba(0,0,0,.02);">
        <div style="font-weight:700; margin-bottom:8px;">${_esc(_t("help.quick_start.title"))}</div>
        <div class="muted" style="margin-bottom:8px;">${_esc(_t("help.quick_start.body"))}</div>
        ${row(periods.length > 0, _t("help.quick_start.periods"), "settings")}
        ${row(wallets.length > 0, _t("help.quick_start.wallets"), "dashboard")}
        ${row(txs.length > 0, _t("help.quick_start.transactions"), "transactions")}
        ${row(trips.length > 0, _t("help.quick_start.trip"), "trip")}
        ${row(docs.length > 0, _t("help.quick_start.documents"), "documents")}
        ${row(assets.length > 0, _t("help.quick_start.assets"), "assets")}
      </div>`;
  }

  function renderGuides(root) {
    let guides = document.getElementById("help-guides");
    if (!guides) {
      guides = document.createElement("div");
      guides.id = "help-guides";
      guides.style.marginTop = "12px";
      guides.style.marginBottom = "12px";
      root.insertBefore(guides, root.querySelector(".form-row"));
    }
    const guideDefs = [
      { kt: "help.guide.create_trip.title", kb: "help.guide.create_trip.body", action: "settings", target: "#s-period-name" },
      { kt: "help.guide.wallets.title", kb: "help.guide.wallets.body", action: "dashboard", target: "#wallets-container" },
      { kt: "help.guide.transactions.title", kb: "help.guide.transactions.body", action: "transactions", target: "#transactions-root" },
      { kt: "help.guide.analysis.title", kb: "help.guide.analysis.body", action: "analysis", target: "#analysis-root" },
      { kt: "help.guide.recurring.title", kb: "help.guide.recurring.body", action: "settings", target: "#recurring-root" },
      { kt: "help.guide.documents.title", kb: "help.guide.documents.body", action: "documents", target: "#documents-root" },
      { kt: "help.guide.assets.title", kb: "help.guide.assets.body", action: "assets", target: "#assets-root" },
      { kt: "help.guide.trip.title", kb: "help.guide.trip.body", action: "trip", target: "#trip-root" }
    ];
    const label = (action) => {
      if (action === "settings") return _t("help.action.open_settings");
      if (action === "dashboard") return _t("help.action.open_dashboard");
      if (action === "trip") return _t("help.action.open_trip");
      if (action === "transactions") return _t("assistant.action.transactions");
      if (action === "analysis") return _t("assistant.action.analysis");
      if (action === "documents") return _t("assistant.action.documents");
      if (action === "assets") return _t("assistant.action.assets");
      return action;
    };
    guides.innerHTML = `
      <div style="font-weight:700; margin-bottom:10px;">${_esc(_t("help.guides.title"))}</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
        ${guideDefs.map(g => `
          <div class="help-guide-card">
            <div style="font-weight:600; margin-bottom:6px;">${_esc(_t(g.kt))}</div>
            <div class="muted" style="margin-bottom:10px;">${_t(g.kb)}</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" style="padding:6px 10px; font-size:12px;" data-help-action="${_esc(g.action)}" data-help-target="${_esc(g.target)}">${_esc(label(g.action))}</button>
            </div>
          </div>`).join("")}
      </div>`;
    if (!guides.__tbBound) {
      guides.__tbBound = true;
      guides.addEventListener("click", ev => {
        const btn = ev.target && ev.target.closest && ev.target.closest("[data-help-action]");
        if (!btn) return;
        ev.preventDefault();
        _runHelpAction(btn.getAttribute("data-help-action") || "", btn.getAttribute("data-help-target") || "");
      });
    }
  }

  function _renderFaqItem(item) {
    const l = _lang();
    const q = (item.q && item.q[l]) || "";
    const a = (item.a && item.a[l]) || "";
    return `<div class="help-faq-card"><div class="help-faq-q">${_esc(q)}</div><div class="help-faq-a">${a}</div></div>`;
  }

  function doSearch() {
    const input = document.getElementById("help-search");
    const q = String(input && input.value || "").trim();
    const results = document.getElementById("help-results");
    const empty = document.getElementById("help-empty");
    if (!results || !empty) return;
    if (!q) { results.innerHTML = ""; empty.classList.add("hidden"); return; }
    const hits = tbSearchFaq(q, 8);
    if (!hits.length) { results.innerHTML = ""; empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    results.innerHTML = `<div class="muted" style="margin:8px 0;">${_esc(_t("help.top_results"))}</div>${hits.map(item => _renderFaqItem(item)).join("")}`;
  }

  window.renderHelpFaq = renderHelpFaq;
  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    if (!window.__tbHelpLangBound) {
      window.__tbHelpLangBound = true;
      window.tbOnLangChange.push(() => {
        try {
          const view = document.getElementById("view-help");
          if (view && !view.classList.contains("hidden")) renderHelpFaq();
        } catch (_) {}
      });
    }
  } catch (_) {}

  function _runHelpAction(action, targetSel) {
    try { if (typeof window.showView === "function" && action) showView(action); } catch (_) {}
    _scrollAndHighlight(targetSel);
  }

  function _scrollAndHighlight(sel) {
    const selector = String(sel || "").trim();
    let tries = 0;
    const tick = () => {
      tries += 1;
      const el = selector ? document.querySelector(selector) : null;
      if (el) {
        const hEl = (/^(INPUT|SELECT|TEXTAREA)$/i.test(String(el.tagName || ""))) ? (el.closest(".field") || el.closest(".row") || el) : el;
        try { hEl.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) { try { hEl.scrollIntoView(); } catch (_) {} }
        try { el.focus && el.focus({ preventScroll: true }); } catch (_) {}
        try { hEl.classList.add("tb-highlight"); setTimeout(() => { try { hEl.classList.remove("tb-highlight"); } catch (_) {} }, 1500); } catch (_) {}
        return;
      }
      if (tries < 18) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
