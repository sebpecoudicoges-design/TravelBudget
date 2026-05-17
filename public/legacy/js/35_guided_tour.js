/* =========================
   Guided tour (FR/EN)
   ========================= */
(function () {
  const TOUR_VERSION = "v2";
  const BASE_KEY = "travelbudget_guided_tour_done_";
  let active = false;
  let index = 0;
  let steps = [];
  let els = {};

  const I18N = {
    fr: {
      start: "Lancer le guide interactif",
      restart: "Revoir le guide interactif",
      next: "Suivant",
      prev: "Precedent",
      skip: "Passer",
      done: "Terminer",
      of: "sur",
      missing: "Cette zone n'est pas encore disponible.",
      s1t: "Navigation",
      s1b: "Utilise ce rail pour passer du budget aux transactions, settings, analyse, documents et partage.",
      s2t: "Vue d'ensemble",
      s2b: "Le dashboard sert a lire l'etat actuel : solde, projection, wallets et budget journalier.",
      s3t: "Wallets",
      s3b: "Tes wallets representent ton cash, tes comptes et cartes. Les depenses payees les impactent directement.",
      s4t: "Budget journalier",
      s4b: "Cette zone t'aide a savoir combien tu peux encore depenser par jour sur la periode active.",
      s5t: "Transactions",
      s5b: "C'est ici que tu ajoutes, filtres et classes les entrees et depenses. Les transactions liees restent protegees.",
      s6t: "Settings",
      s6b: "Regle les voyages, periodes, devises, categories, recurrentes et preferences ici.",
      s7t: "Analyse",
      s7b: "L'analyse sert a comparer reel, budget, rythme, categories et decisions de change.",
      s8t: "Aide",
      s8b: "Tu peux relancer ce guide depuis l'aide, puis ouvrir des mini-guides par module.",
      m_dashboard_t: "Lire le dashboard",
      m_dashboard_b: "Commence par le haut : periode active, devise, solde reel, projection et budget disponible.",
      m_wallets_t: "Gerer tes wallets",
      m_wallets_b: "Ajoute une depense ou une entree depuis le wallet concerne. Le solde suit seulement les operations payees.",
      m_daily_t: "Piloter le budget journalier",
      m_daily_b: "Cette carte explique ce que tu peux encore depenser sur les jours a venir.",
      m_tx_filters_t: "Filtrer avant d'agir",
      m_tx_filters_b: "Filtre par date, wallet, categorie, statut de paiement ou facture avant de modifier en masse.",
      m_tx_bulk_t: "Classer en lot",
      m_tx_bulk_b: "Selectionne les lignes visibles puis applique une categorie. Les transactions liees restent protegees.",
      m_settings_trip_t: "Voyage et periodes",
      m_settings_trip_b: "C'est ici que tu ajustes les dates, devises et budgets/jour de chaque periode.",
      m_settings_rec_t: "Recurrences",
      m_settings_rec_b: "Ajoute salaires, abonnements ou loyers recurrents pour fiabiliser la projection.",
      m_analysis_t: "Analyse budget",
      m_analysis_b: "Lis les ecarts entre reel, budget source, cadence et categories dominantes.",
      m_fx_t: "Decision de change",
      m_fx_b: "Compare deux devises, choisis ton horizon et vois si convertir maintenant est pertinent.",
      m_documents_t: "Classer les documents",
      m_documents_b: "Range les fichiers par dossier, ajoute des tags et lie-les aux transactions, trips ou assets.",
      m_assets_t: "Patrimoine",
      m_assets_b: "Suis la valeur de tes biens, leurs documents, coproprietaires et mouvements d'achat/vente.",
      m_trip_t: "Partage",
      m_trip_b: "Ajoute les participants, les depenses partagees et laisse l'app calculer les soldes.",
      guideAll: "Guide global",
      guideModule: "Guide module",
      actionWallet: "Ajouter un wallet",
      actionExpense: "Ajouter une depense",
      actionIncome: "Ajouter une entree",
      actionEditTx: "Modifier une transaction",
      actionBulk: "Classer en lot",
      actionSettings: "Parametrer",
      actionRecurring: "Nouvelle regle",
      actionFx: "Comparer les devises",
      actionDocs: "Ajouter un document",
      actionAsset: "Ajouter un asset",
      actionTripMember: "Ajouter un membre",
      actionTripExpense: "Ajouter une depense partagee"
    },
    en: {
      start: "Start interactive guide",
      restart: "Replay interactive guide",
      next: "Next",
      prev: "Previous",
      skip: "Skip",
      done: "Finish",
      of: "of",
      missing: "This area is not available yet.",
      s1t: "Navigation",
      s1b: "Use this rail to move from budget to transactions, settings, analysis, documents and split.",
      s2t: "Overview",
      s2b: "The dashboard shows the current state: balance, projection, wallets and daily budget.",
      s3t: "Wallets",
      s3b: "Wallets represent your cash, accounts and cards. Paid transactions affect them immediately.",
      s4t: "Daily budget",
      s4b: "This area helps you see how much you can still spend per day over the active period.",
      s5t: "Transactions",
      s5b: "This is where you add, filter and classify income and expenses. Linked transactions stay protected.",
      s6t: "Settings",
      s6b: "Manage trips, periods, currencies, categories, recurring rules and preferences here.",
      s7t: "Analysis",
      s7b: "Analysis compares actuals, budget, pace, categories and FX decisions.",
      s8t: "Help",
      s8b: "You can replay this guide from Help, then open module-specific mini-guides.",
      m_dashboard_t: "Read the dashboard",
      m_dashboard_b: "Start from the top: active period, currency, real balance, projection and available budget.",
      m_wallets_t: "Manage wallets",
      m_wallets_b: "Add an expense or income from the related wallet. Only paid items affect wallet balances.",
      m_daily_t: "Drive the daily budget",
      m_daily_b: "This card shows how much you can still spend over the coming days.",
      m_tx_filters_t: "Filter before acting",
      m_tx_filters_b: "Filter by date, wallet, category, payment status or invoice before bulk-editing.",
      m_tx_bulk_t: "Bulk classify",
      m_tx_bulk_b: "Select visible rows, then apply a category. Linked transactions stay protected.",
      m_settings_trip_t: "Trip and periods",
      m_settings_trip_b: "Adjust dates, currencies and daily budgets for each period here.",
      m_settings_rec_t: "Recurring rules",
      m_settings_rec_b: "Add salaries, subscriptions or rent to make projections more reliable.",
      m_analysis_t: "Budget analysis",
      m_analysis_b: "Read gaps between actuals, reference budget, pace and dominant categories.",
      m_fx_t: "FX decision",
      m_fx_b: "Compare two currencies, choose your horizon and see whether converting now makes sense.",
      m_documents_t: "Organize documents",
      m_documents_b: "File documents by folder, add tags and link them to transactions, trips or assets.",
      m_assets_t: "Assets",
      m_assets_b: "Track asset value, documents, co-owners and buy/sell movements.",
      m_trip_t: "Split",
      m_trip_b: "Add participants and shared expenses, then let the app compute balances.",
      guideAll: "Full guide",
      guideModule: "Module guide",
      actionWallet: "Add wallet",
      actionExpense: "Add expense",
      actionIncome: "Add income",
      actionEditTx: "Edit transaction",
      actionBulk: "Bulk classify",
      actionSettings: "Configure",
      actionRecurring: "New rule",
      actionFx: "Compare currencies",
      actionDocs: "Add document",
      actionAsset: "Add asset",
      actionTripMember: "Add member",
      actionTripExpense: "Add shared expense"
    }
  };

  function lang() {
    try { return String(window.TB_LANG || "fr").toLowerCase() === "en" ? "en" : "fr"; } catch (_) { return "fr"; }
  }

  function t(k) {
    const l = lang();
    return (I18N[l] && I18N[l][k]) || (I18N.fr && I18N.fr[k]) || k;
  }

  function uid() {
    try { return window.sbUser?.id || "anonymous"; } catch (_) { return "anonymous"; }
  }

  function doneKey() {
    return BASE_KEY + TOUR_VERSION + "_" + uid();
  }

  function isDone() {
    try { return localStorage.getItem(doneKey()) === "1"; } catch (_) { return false; }
  }

  function markDone() {
    try { localStorage.setItem(doneKey(), "1"); } catch (_) {}
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function firstVisible(selectors) {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (visible(el)) return el;
      } catch (_) {}
    }
    return null;
  }

  function baseSteps() {
    return [
      { view: "dashboard", selectors: [".app-tabs", "#tab-dashboard"], title: "s1t", body: "s1b" },
      { view: "dashboard", selectors: ["#view-dashboard", "#dashboard-hero-shell", "#kpi"], title: "s2t", body: "s2b" },
      { view: "dashboard", selectors: ["#wallets-container", ".dashboard-panel--wallets"], title: "s3t", body: "s3b", action: "wallet_create", actionLabel: "actionWallet" },
      { view: "dashboard", selectors: ["#daily-budget-container", ".dashboard-panel--budget"], title: "s4t", body: "s4b" },
      { view: "transactions", selectors: ["#view-transactions .toolbar-card", "#view-transactions"], title: "s5t", body: "s5b", action: "tx_add_expense", actionLabel: "actionExpense" },
      { view: "settings", selectors: ["#view-settings .tb-settings-card", "#view-settings"], title: "s6t", body: "s6b", action: "settings_trip", actionLabel: "actionSettings" },
      { view: "analysis", selectors: ["#view-analysis", "#analysis-root"], title: "s7t", body: "s7b" },
      { view: "help", selectors: ["#view-help", "#help-root"], title: "s8t", body: "s8b" }
    ];
  }

  function moduleSteps(mode) {
    const map = {
      dashboard: [
        { view: "dashboard", selectors: ["#view-dashboard", "#dashboard-hero-shell", "#kpi"], title: "m_dashboard_t", body: "m_dashboard_b" },
        { view: "dashboard", selectors: ["#wallets-container", ".dashboard-panel--wallets"], title: "m_wallets_t", body: "m_wallets_b", action: "wallet_create", actionLabel: "actionWallet" },
        { view: "dashboard", selectors: ["#daily-budget-container", ".dashboard-panel--budget"], title: "m_daily_t", body: "m_daily_b" }
      ],
      transactions: [
        { view: "transactions", selectors: ["#view-transactions .toolbar-card", "#view-transactions"], title: "m_tx_filters_t", body: "m_tx_filters_b", action: "tx_add_expense", actionLabel: "actionExpense" },
        { view: "transactions", selectors: ["#tx-bulk-panel", "#tx-list", "#view-transactions .card"], title: "m_tx_bulk_t", body: "m_tx_bulk_b", action: "tx_bulk", actionLabel: "actionBulk" }
      ],
      settings: [
        { view: "settings", selectors: ["#view-settings", "#settings-root"], title: "m_settings_trip_t", body: "m_settings_trip_b", action: "settings_trip", actionLabel: "actionSettings" },
        { view: "settings", selectors: ["#recurring-root", "[data-settings-section='recurring']", "#view-settings"], title: "m_settings_rec_t", body: "m_settings_rec_b", action: "recurring_create", actionLabel: "actionRecurring" }
      ],
      analysis: [
        { view: "analysis", selectors: ["#view-analysis", "#analysis-root"], title: "m_analysis_t", body: "m_analysis_b" },
        { view: "analysis", selectors: ["#fx-decision-root", ".fx-decision-card", "#view-analysis"], title: "m_fx_t", body: "m_fx_b", action: "analysis_fx", actionLabel: "actionFx" }
      ],
      documents: [
        { view: "documents", selectors: ["#documents-root", "#view-documents"], title: "m_documents_t", body: "m_documents_b", action: "documents_upload", actionLabel: "actionDocs" }
      ],
      assets: [
        { view: "assets", selectors: ["#assets-root", "#view-assets"], title: "m_assets_t", body: "m_assets_b", action: "asset_create", actionLabel: "actionAsset" }
      ],
      trip: [
        { view: "trip", selectors: ["#trip-root", "#view-trip"], title: "m_trip_t", body: "m_trip_b", action: "trip_expense", actionLabel: "actionTripExpense" }
      ],
      split: [
        { view: "trip", selectors: ["#trip-root", "#view-trip"], title: "m_trip_t", body: "m_trip_b", action: "trip_expense", actionLabel: "actionTripExpense" }
      ],
      inbox: [
        { view: "inbox", selectors: ["#inbox-root", "#view-inbox"], title: "m_documents_t", body: "m_documents_b" }
      ]
    };
    return map[String(mode || "").toLowerCase()] || null;
  }

  function makeSteps(mode) {
    return moduleSteps(mode) || baseSteps();
  }

  function ensureUi() {
    if (els.overlay) return;
    const style = document.createElement("style");
    style.id = "tb-guided-tour-style";
    style.textContent = `
      .tb-tour-overlay{position:fixed;inset:0;z-index:999998;pointer-events:none;}
      .tb-tour-scrim{position:absolute;inset:0;background:rgba(15,23,42,.24);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);pointer-events:auto;}
      .tb-tour-spot{position:absolute;border-radius:22px;border:2px solid rgba(59,130,246,.95);box-shadow:0 0 0 9999px rgba(15,23,42,.42),0 20px 60px rgba(37,99,235,.22);transition:all .2s ease;pointer-events:none;}
      .tb-tour-bubble{position:absolute;width:min(360px,calc(100vw - 28px));border-radius:22px;background:rgba(255,255,255,.98);border:1px solid rgba(148,163,184,.28);box-shadow:0 24px 80px rgba(15,23,42,.28);padding:16px;pointer-events:auto;color:#0f172a;}
      body.theme-dark .tb-tour-bubble{background:rgba(15,23,42,.98);color:#f8fafc;border-color:rgba(255,255,255,.12);}
      .tb-tour-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;margin-bottom:8px;}
      .tb-tour-title{font-weight:950;font-size:18px;line-height:1.18;margin-bottom:8px;}
      .tb-tour-body{font-size:13px;line-height:1.45;color:#64748b;}
      body.theme-dark .tb-tour-body{color:#cbd5e1;}
      .tb-tour-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;}
      .tb-tour-actions-left,.tb-tour-actions-right{display:flex;gap:8px;align-items:center;}
      .tb-tour-btn{border:1px solid rgba(148,163,184,.34);background:#fff;border-radius:999px;padding:9px 12px;font-weight:900;cursor:pointer;color:#0f172a;}
      .tb-tour-btn.primary{border-color:transparent;background:linear-gradient(135deg,#0f2e74,#2563eb);color:#fff;}
      body.theme-dark .tb-tour-btn{background:#1e293b;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      .tb-tour-progress{font-size:12px;color:#64748b;font-weight:800;}
      body.theme-dark .tb-tour-progress{color:#cbd5e1;}
      @media(max-width:720px){.tb-tour-bubble{left:14px!important;right:14px!important;top:auto!important;bottom:14px!important;width:auto;}}
    `;
    document.head.appendChild(style);

    els.overlay = document.createElement("div");
    els.overlay.className = "tb-tour-overlay";
    els.overlay.innerHTML = `
      <div class="tb-tour-scrim"></div>
      <div class="tb-tour-spot"></div>
      <div class="tb-tour-bubble" role="dialog" aria-live="polite">
        <div class="tb-tour-kicker"></div>
        <div class="tb-tour-title"></div>
        <div class="tb-tour-body"></div>
        <div class="tb-tour-actions">
          <div class="tb-tour-actions-left">
            <button class="tb-tour-btn" data-tour="skip"></button>
            <button class="tb-tour-btn primary" data-tour="action" style="display:none;"></button>
          </div>
          <div class="tb-tour-actions-right">
            <span class="tb-tour-progress"></span>
            <button class="tb-tour-btn" data-tour="prev"></button>
            <button class="tb-tour-btn primary" data-tour="next"></button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(els.overlay);
    els.scrim = els.overlay.querySelector(".tb-tour-scrim");
    els.spot = els.overlay.querySelector(".tb-tour-spot");
    els.bubble = els.overlay.querySelector(".tb-tour-bubble");
    els.kicker = els.overlay.querySelector(".tb-tour-kicker");
    els.title = els.overlay.querySelector(".tb-tour-title");
    els.body = els.overlay.querySelector(".tb-tour-body");
    els.progress = els.overlay.querySelector(".tb-tour-progress");
    els.skip = els.overlay.querySelector('[data-tour="skip"]');
    els.action = els.overlay.querySelector('[data-tour="action"]');
    els.prev = els.overlay.querySelector('[data-tour="prev"]');
    els.next = els.overlay.querySelector('[data-tour="next"]');
    els.skip.addEventListener("click", stop);
    els.action.addEventListener("click", () => runStepAction(steps[index] || {}));
    els.prev.addEventListener("click", () => go(index - 1));
    els.next.addEventListener("click", () => {
      if (index >= steps.length - 1) stop();
      else go(index + 1);
    });
    window.addEventListener("resize", () => { if (active) position(); });
    window.addEventListener("scroll", () => { if (active) position(); }, true);
  }

  function setText() {
    if (!els.overlay) return;
    els.skip.textContent = t("skip");
    els.prev.textContent = t("prev");
    els.next.textContent = index >= steps.length - 1 ? t("done") : t("next");
    els.prev.style.display = index <= 0 ? "none" : "";
    const step = steps[index] || {};
    if (els.action) {
      const hasAction = !!step.action;
      els.action.style.display = hasAction ? "" : "none";
      els.action.textContent = hasAction ? t(step.actionLabel || "guideModule") : "";
    }
  }

  function currentTarget() {
    const step = steps[index] || {};
    return firstVisible(step.selectors || []);
  }

  function position() {
    const target = currentTarget();
    const pad = 8;
    const rect = target ? target.getBoundingClientRect() : { left: 24, top: 100, width: 260, height: 80, right: 284, bottom: 180 };
    const left = Math.max(8, rect.left - pad);
    const top = Math.max(8, rect.top - pad);
    const width = Math.min(window.innerWidth - left - 8, rect.width + pad * 2);
    const height = Math.min(window.innerHeight - top - 8, rect.height + pad * 2);
    Object.assign(els.spot.style, {
      left: left + "px",
      top: top + "px",
      width: Math.max(42, width) + "px",
      height: Math.max(42, height) + "px"
    });

    const bubbleRect = els.bubble.getBoundingClientRect();
    let bx = rect.right + 16;
    let by = rect.top;
    if (bx + bubbleRect.width > window.innerWidth - 14) bx = rect.left - bubbleRect.width - 16;
    if (bx < 14) bx = Math.min(window.innerWidth - bubbleRect.width - 14, 14);
    if (by + bubbleRect.height > window.innerHeight - 14) by = window.innerHeight - bubbleRect.height - 14;
    if (by < 14) by = 14;
    els.bubble.style.left = bx + "px";
    els.bubble.style.top = by + "px";
  }

  function render() {
    const step = steps[index] || steps[0];
    if (!step) return;
    els.kicker.textContent = `${index + 1} ${t("of")} ${steps.length}`;
    els.title.textContent = t(step.title);
    els.body.textContent = currentTarget() ? t(step.body) : t("missing");
    els.progress.textContent = `${index + 1}/${steps.length}`;
    setText();
    try { currentTarget()?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }); } catch (_) {}
    setTimeout(position, 180);
  }

  function go(nextIndex) {
    index = Math.max(0, Math.min(steps.length - 1, Number(nextIndex) || 0));
    const step = steps[index];
    if (step?.view && typeof window.showView === "function") {
      try { window.showView(step.view); } catch (_) {}
    }
    render();
  }

  function firstWalletId() {
    try {
      const rows = Array.isArray(window.state?.wallets) ? window.state.wallets : [];
      const activeTravelId = String(window.state?.activeTravelId || "");
      const found = rows.find(w => !activeTravelId || String(w.travelId || w.travel_id || "") === activeTravelId) || rows[0];
      return found ? String(found.id || "") : "";
    } catch (_) { return ""; }
  }

  function firstTransactionId() {
    try {
      const rows = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
      const found = rows.find(tx => !tx?.isInternal && !tx?.is_internal) || rows[0];
      return found ? String(found.id || "") : "";
    } catch (_) { return ""; }
  }

  function highlight(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      const el = sel ? document.querySelector(sel) : null;
      if (!el) continue;
      try { el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }); } catch (_) {}
      try {
        el.style.boxShadow = "0 0 0 3px rgba(37,99,235,.28)";
        setTimeout(() => { try { el.style.boxShadow = ""; } catch (_) {} }, 1800);
      } catch (_) {}
      return true;
    }
    return false;
  }

  function afterView(view, cb) {
    try { if (view && typeof window.showView === "function") window.showView(view); } catch (_) {}
    setTimeout(() => { try { cb && cb(); } catch (e) { console.warn("[Tour] action failed", e?.message || e); } }, 220);
  }

  function runStepAction(step) {
    const action = String(step?.action || "").trim();
    if (!action) return;
    if (action === "wallet_create") {
      afterView("dashboard", () => {
        if (typeof window.createWallet === "function") window.createWallet();
        else highlight(["#wallets-container"]);
      });
      return;
    }
    if (action === "tx_add_expense" || action === "tx_add_income") {
      afterView(action === "tx_add_income" ? "dashboard" : "transactions", () => {
        const type = action === "tx_add_income" ? "income" : "expense";
        if (typeof window.openTxModal === "function") window.openTxModal(type, firstWalletId() || null);
        else highlight(["#view-transactions", "#wallets-container"]);
      });
      return;
    }
    if (action === "tx_edit_first") {
      afterView("transactions", () => {
        const txId = firstTransactionId();
        if (txId && typeof window.openTxEditModal === "function") window.openTxEditModal(txId);
        else highlight(["[data-tx-id]", "#view-transactions"]);
      });
      return;
    }
    if (action === "tx_bulk") {
      afterView("transactions", () => highlight(["#tx-bulk-panel", "#tx-list", "#view-transactions"]));
      return;
    }
    if (action === "settings_trip") {
      afterView("settings", () => highlight(["#s-period-name", "#tb-inline-travel-start", "#settings-root", "#view-settings"]));
      return;
    }
    if (action === "recurring_create") {
      afterView("settings", () => {
        if (typeof window.openRecurringRuleModal === "function") window.openRecurringRuleModal();
        else highlight(["#recurring-root", "#tb-recurring-card", "#view-settings"]);
      });
      return;
    }
    if (action === "analysis_fx") {
      afterView("analysis", () => highlight(["#fx-decision-root", ".fx-decision-card", "#view-analysis"]));
      return;
    }
    if (action === "documents_upload") {
      afterView("documents", () => highlight(["#documents-root input[type='file']", ".tb-doc-drop", "#documents-root", "#view-documents"]));
      return;
    }
    if (action === "asset_create") {
      afterView("assets", () => {
        const btn = document.querySelector("[data-tb-asset-open]");
        if (btn) btn.click();
        else highlight(["#assets-root", "#view-assets"]);
      });
      return;
    }
    if (action === "trip_expense") {
      afterView("trip", () => {
        const btn = document.getElementById("trip-add-exp");
        if (btn) btn.click();
        else highlight(["#trip-root", "#view-trip"]);
      });
      return;
    }
  }

  function start(opts) {
    if (active) return;
    steps = makeSteps(opts?.mode || opts?.module || opts?.view || "");
    if (!steps.length) return;
    ensureUi();
    active = true;
    index = 0;
    els.overlay.style.display = "block";
    go(Number(opts?.startIndex || 0));
  }

  function stop() {
    if (!active && !els.overlay) return;
    active = false;
    markDone();
    if (els.overlay) els.overlay.style.display = "none";
  }

  function maybeAutoStart() {
    if (active || isDone()) return;
    if (!window.sbUser) return;
    const overlay = document.getElementById("auth-overlay");
    if (overlay && overlay.style.display !== "none") return;
    setTimeout(() => {
      if (!active && !isDone() && window.sbUser) start();
    }, 900);
  }

  function injectHelpButton() {
    const root = document.getElementById("help-root");
    if (!root || document.getElementById("tb-tour-help-launch")) return;
    const box = document.createElement("div");
    box.id = "tb-tour-help-launch";
    box.className = "help-guide-card";
    box.style.margin = "12px 0";
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:800;">${t("restart")}</div>
          <div class="muted" style="margin-top:4px;">${lang() === "en" ? "A short overlay tour of the main app areas." : "Un tour rapide par bulles des zones principales de l'app."}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn primary" type="button" data-tour-mode="">${t("guideAll")}</button>
          <button class="btn" type="button" data-tour-mode="transactions">Transactions</button>
          <button class="btn" type="button" data-tour-mode="analysis">${lang() === "en" ? "Analysis" : "Analyse"}</button>
          <button class="btn" type="button" data-tour-mode="documents">Documents</button>
        </div>
      </div>`;
    box.addEventListener("click", (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest("[data-tour-mode]");
      if (!btn) return;
      start({ mode: btn.getAttribute("data-tour-mode") || "" });
    });
    const anchor = root.querySelector("#help-quick-setup") || root.firstChild;
    root.insertBefore(box, anchor ? anchor.nextSibling : null);
  }

  window.tbStartGuidedTour = start;
  window.tbMaybeStartGuidedTour = maybeAutoStart;
  window.tbInjectGuidedTourHelpButton = injectHelpButton;

  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    window.tbOnLangChange.push(() => {
      if (active) render();
      const old = document.getElementById("tb-tour-help-launch");
      if (old) old.remove();
      injectHelpButton();
    });
  } catch (_) {}

  try {
    if (window.tbBus && typeof window.tbBus.on === "function") {
      window.tbBus.on("view:changed", (ev) => {
        if (ev?.view === "help") setTimeout(injectHelpButton, 80);
      });
    }
  } catch (_) {}

  document.addEventListener("DOMContentLoaded", () => setTimeout(maybeAutoStart, 1200));
  window.addEventListener("load", () => setTimeout(maybeAutoStart, 1400));
})();
