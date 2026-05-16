/* =========================
   Help Assistant (V9.7.0.1)
   - Offline mini assistant: routes common intents + searches FAQ
   - Context pack + quick navigation
   ========================= */
(function () {
  function t(k) { return (window.tbT ? tbT(k) : k); }
  function lang() { return (window.tbGetLang && tbGetLang()) || "fr"; }
  function esc(s) {
    if (typeof window.escapeHTML === "function") return window.escapeHTML(s);
    return String(s || "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function norm(s) {
    try { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
    catch (_) { return String(s || "").toLowerCase(); }
  }
  function atxt(fr, en) { return lang() === "en" ? en : fr; }
  function fallbackT(key, fr, en) {
    const value = t(key);
    return value === key ? atxt(fr, en) : value;
  }

  const LS_THREAD = (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.assist_thread) || "travelbudget_assist_thread_v1";
  const LS_OPEN   = (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.assist_open)   || "travelbudget_assist_open_v1";

  function loadThread() {
    try { const arr = JSON.parse(localStorage.getItem(LS_THREAD) || "[]"); return Array.isArray(arr) ? arr.filter(Boolean).slice(-80) : []; }
    catch (_) { return []; }
  }
  function saveThread(arr) { try { localStorage.setItem(LS_THREAD, JSON.stringify((arr || []).slice(-80))); } catch (_) {} }
  function isOpenPersisted() { try { return localStorage.getItem(LS_OPEN) === "1"; } catch (_) { return false; } }
  function setOpenPersisted(v) { try { localStorage.setItem(LS_OPEN, v ? "1" : "0"); } catch (_) {} }

  function _periodName() {
    try {
      const pid = String(window.state?.period?.id || "");
      if (pid && typeof window.tbGetPeriodName === "function") return window.tbGetPeriodName(pid) || "Voyage";
    } catch (_) {}
    return "Voyage";
  }

  function countState(name) {
    try { const arr = window.state && window.state[name]; return Array.isArray(arr) ? arr.length : 0; } catch (_) { return 0; }
  }

  function displayCurrency() {
    try {
      if (typeof window.getDisplayCurrency === "function") return String(window.getDisplayCurrency() || "").toUpperCase();
    } catch (_) {}
    try { return String(window.state?.user?.baseCurrency || window.state?.period?.baseCurrency || "EUR").toUpperCase(); } catch (_) {}
    return "EUR";
  }

  function currentView() {
    try { if (window.activeView) return String(window.activeView); } catch (_) {}
    try {
      const active = document.querySelector(".tab.active");
      const id = String(active?.id || "");
      if (id.startsWith("tab-")) return id.slice(4);
    } catch (_) {}
    return "dashboard";
  }

  function viewLabel(view) {
    const v = String(view || "").toLowerCase();
    const labels = {
      dashboard: "Dashboard",
      transactions: t("assistant.action.transactions"),
      settings: t("assistant.action.settings"),
      analysis: t("assistant.action.analysis"),
      documents: t("assistant.action.documents"),
      assets: t("assistant.action.assets"),
      trip: t("assistant.action.trip"),
      help: t("assistant.action.help"),
    };
    return labels[v] || v || "Dashboard";
  }

  function convertForAssistant(amount, from, to) {
    const a = Number(amount) || 0;
    const src = String(from || to || "").toUpperCase();
    const dst = String(to || src || "").toUpperCase();
    if (!src || src === dst) return a;
    try {
      if (typeof window.fxConvert === "function") {
        const rates = typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {};
        const out = window.fxConvert(a, src, dst, rates);
        if (out !== null && isFinite(out)) return Number(out);
      }
    } catch (_) {}
    try {
      if (typeof window.amountToDisplayForDate === "function" && dst === displayCurrency()) {
        const out = window.amountToDisplayForDate(a, src, (typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : undefined);
        if (isFinite(out)) return Number(out);
      }
    } catch (_) {}
    return a;
  }

  function assistantInsights() {
    try {
      const rules = window.Core?.assistantRules;
      if (!rules || typeof rules.buildAssistantContextualInsights !== "function") return [];
      const seg = (typeof window.getDisplaySegment === "function") ? window.getDisplaySegment() : null;
      return rules.buildAssistantContextualInsights(window.state || {}, {
        today: (typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : new Date().toISOString().slice(0, 10),
        view: currentView(),
        displayCurrency: displayCurrency(),
        dailyBudget: Number(seg?.dailyBudgetBase || seg?.daily_budget_base || window.state?.period?.dailyBudgetBase || 0),
        convertAmount: convertForAssistant,
        limit: 6,
      });
    } catch (e) {
      console.warn("[assistant] insights failed", e);
      return [];
    }
  }

  function insightLevelLabel(level) {
    if (level === "warning") return fallbackT("assistant.insight.warning", "A surveiller", "Watch");
    if (level === "ok") return fallbackT("assistant.insight.ok", "OK", "OK");
    return fallbackT("assistant.insight.info", "Info", "Info");
  }

  function renderInsightCards() {
    const root = document.getElementById("tb-assist-insights");
    if (!root) return;
    const items = assistantInsights();
    root.innerHTML = items.map((x) => `
      <button type="button" class="tb-assist-insight ${esc(x.level || "info")}" data-assist-view="${esc(x.view || "dashboard")}" data-assist-code="${esc(x.code || "")}">
        <span>${esc(insightLevelLabel(x.level))}</span>
        <strong>${esc(x.title || "")}</strong>
        <small>${esc(x.body || "")}</small>
      </button>
    `).join("");
  }

  function quickAnalysisText() {
    const items = assistantInsights();
    if (!items.length) return fallbackT("assistant.quick.empty", "Je n'ai pas encore assez de donnees chargees pour analyser.", "I do not have enough loaded data to analyze yet.");
    const intro = fallbackT("assistant.quick.intro", "Analyse rapide :", "Quick analysis:");
    return `${intro}\n${items.map((x) => `- ${x.title}: ${x.body}`).join("\n")}`;
  }

  function buildContextPack() {
    try {
      const p = window.state?.period || {};
      const start = String(p.start || "").slice(0,10);
      const end = String(p.end || "").slice(0,10);
      const seg = (typeof window.getBudgetSegmentForDate === "function")
        ? window.getBudgetSegmentForDate((typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : new Date().toISOString().slice(0,10))
        : null;
      const segStr = seg ? `${String(seg.start||"").slice(0,10)} -> ${String(seg.end||"").slice(0,10)} (${String(seg.baseCurrency||"").toUpperCase()})` : "-";
      const eurAsOf = (() => { try { return localStorage.getItem((TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.eur_rates_asof) || "travelbudget_fx_eur_rates_asof_v1") || ""; } catch (_) { return ""; } })();
      const refDay = (typeof window.tbFxRefDay === "function") ? String(window.tbFxRefDay() || "") : "";
      const stale = (eurAsOf && refDay) ? (String(eurAsOf) < String(refDay)) : false;
      const fxLine = eurAsOf ? (stale ? t("assistant.context.fx_stale") : t("assistant.context.fx_ok")) : t("assistant.context.fx_missing");
      return [
        { k: t("assistant.context.trip"), v: `${_periodName()}${(start&&end)?` - ${start} -> ${end}`:""}` },
        { k: t("assistant.context.period"), v: segStr },
        { k: "FX", v: fxLine },
        { k: t("assistant.context.modules"), v: `${countState("transactions")} tx - ${countState("wallets")} wallets - ${countState("documents")} docs - ${countState("assets")} assets` }
      ];
    } catch (_) { return []; }
  }

    function go(view, target) {
    try { if (typeof showView === "function") showView(view); } catch (_) {}
    if (target) setTimeout(() => { try { const el = document.querySelector(target); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {} }, 80);
  }

  function applyInsightAction(code, view) {
    const c = String(code || "");
    const v = String(view || "dashboard");
    if (c === "uncategorized") {
      try { if (typeof window.tbTransactionsApplyAssistantFilter === "function") return window.tbTransactionsApplyAssistantFilter("uncategorized"); } catch (_) {}
    }
    if (c === "pending_cashflow") {
      try { if (typeof window.tbTransactionsApplyAssistantFilter === "function") return window.tbTransactionsApplyAssistantFilter("pending"); } catch (_) {}
    }
    if (c === "locked_transactions" || c === "trip_linked_tx") {
      try { if (typeof window.tbTransactionsApplyAssistantFilter === "function") return window.tbTransactionsApplyAssistantFilter("linked"); } catch (_) {}
    }
    if (c === "internal_transfers") {
      try { if (typeof window.tbTransactionsApplyAssistantFilter === "function") return window.tbTransactionsApplyAssistantFilter("internal"); } catch (_) {}
    }
    if (c === "expiring_docs") {
      go("documents", "#documents-root");
      setTimeout(() => { try { if (typeof window.tbDocumentsSetAssistantFilter === "function") window.tbDocumentsSetAssistantFilter("expiring"); } catch (_) {} }, 160);
      return;
    }
    if (c === "untagged_docs" || c === "unlinked_documents") {
      go("documents", "#documents-root");
      setTimeout(() => { try { if (typeof window.tbDocumentsSetAssistantFilter === "function") window.tbDocumentsSetAssistantFilter("untagged"); } catch (_) {} }, 160);
      return;
    }
    go(v);
  }

  function ensureDom() {
    if (document.getElementById("tb-assist-btn")) return;
    const btn = document.createElement("button");
    btn.id = "tb-assist-btn";
    btn.className = "tb-assist-btn";
    btn.type = "button";
    btn.innerHTML = "AI";
    btn.title = t("assistant.title");

    const panel = document.createElement("div");
    panel.id = "tb-assist-panel";
    panel.className = "tb-assist-panel hidden";
    panel.innerHTML = `
      <div class="tb-assist-head">
        <div class="tb-assist-title">${esc(t("assistant.title"))}</div>
        <div class="tb-assist-actions">
          <button type="button" class="tb-assist-link" id="tb-assist-open-faq">${esc(t("assistant.suggest_faq"))}</button>
          <button type="button" class="tb-assist-x" id="tb-assist-close" aria-label="${esc(t("assistant.close"))}">x</button>
        </div>
      </div>
      <div class="tb-assist-body">
        <div id="tb-assist-context" style="margin-bottom:10px; padding:10px; border:1px solid rgba(0,0,0,0.08); border-radius:14px; background:rgba(0,0,0,0.02);">
          <div class="muted" style="font-size:12px; font-weight:700; margin-bottom:6px;">${esc(t("assistant.context_title"))}</div>
          <div id="tb-assist-context-lines" class="muted" style="font-size:12px; line-height:1.35;"></div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            <button type="button" class="btn primary" id="tb-assist-quick" style="padding:6px 10px; font-size:12px;">${esc(fallbackT("assistant.action.quick_analysis", "Analyse rapide", "Quick analysis"))}</button>
            <button type="button" class="btn" data-assist-view="settings" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.settings"))}</button>
            <button type="button" class="btn" data-assist-view="dashboard" data-assist-target="#wallets-container" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.wallets"))}</button>
            <button type="button" class="btn" data-assist-view="transactions" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.transactions"))}</button>
            <button type="button" class="btn" data-assist-view="analysis" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.analysis"))}</button>
            <button type="button" class="btn" data-assist-view="documents" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.documents"))}</button>
            <button type="button" class="btn" data-assist-view="assets" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.assets"))}</button>
            <button type="button" class="btn" data-assist-view="trip" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.trip"))}</button>
          </div>
        </div>
        <div class="tb-assist-insights-head" id="tb-assist-insights-head">${esc(fallbackT("assistant.insights_title", "Signaux rapides", "Quick signals"))}</div>
        <div id="tb-assist-insights" class="tb-assist-insights"></div>
        <div class="tb-assist-hint">${esc(t("assistant.hint"))}</div>
        <div id="tb-assist-thread" class="tb-assist-thread"></div>
      </div>
      <div class="tb-assist-foot">
        <input id="tb-assist-input" class="tb-assist-input" type="text" placeholder="${esc(t("assistant.placeholder"))}" />
        <button id="tb-assist-send" class="tb-assist-send" type="button">${esc(t("assistant.send"))}</button>
      </div>`;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    function renderContext() {
      const linesEl = document.getElementById("tb-assist-context-lines");
      if (!linesEl) return;
      const v = currentView();
      linesEl.innerHTML = [
        { k: fallbackT("assistant.context.view", "Vue", "View"), v: viewLabel(v) },
        ...buildContextPack()
      ].map(x => `<div><strong style="color:var(--text);">${esc(x.k)}</strong> : ${esc(x.v)}</div>`).join("");
      const head = document.getElementById("tb-assist-insights-head");
      if (head) head.textContent = `${fallbackT("assistant.insights_title", "Signaux rapides", "Quick signals")} - ${viewLabel(v)}`;
      renderInsightCards();
    }
    function openPanel() { panel.classList.remove("hidden"); setOpenPersisted(true); renderContext(); document.getElementById("tb-assist-input")?.focus(); }
    function closePanel() { panel.classList.add("hidden"); setOpenPersisted(false); }
    btn.addEventListener("click", () => panel.classList.contains("hidden") ? openPanel() : closePanel());
    panel.querySelector("#tb-assist-close")?.addEventListener("click", closePanel);
    panel.querySelector("#tb-assist-open-faq")?.addEventListener("click", () => { go("help"); closePanel(); });
    panel.querySelector("#tb-assist-quick")?.addEventListener("click", () => appendMsg("bot", quickAnalysisText()));
    panel.addEventListener("click", ev => {
      const b = ev.target && ev.target.closest && ev.target.closest("[data-assist-view]");
      if (!b) return;
      const code = b.getAttribute("data-assist-code") || "";
      if (code) applyInsightAction(code, b.getAttribute("data-assist-view"));
      else go(b.getAttribute("data-assist-view"), b.getAttribute("data-assist-target"));
    });

    const threadData = loadThread();
    function appendMsg(role, text, persist=true) {
      const thread = document.getElementById("tb-assist-thread");
      if (!thread) return;
      const div = document.createElement("div");
      div.className = "tb-assist-msg " + (role === "user" ? "user" : "bot");
      div.textContent = String(text || "");
      thread.appendChild(div);
      thread.scrollTop = thread.scrollHeight;
      if (persist) { threadData.push({ role: role === "user" ? "user" : "bot", text: String(text || ""), t: Date.now() }); saveThread(threadData); }
    }
    threadData.forEach(m => appendMsg(m.role, m.text, false));

    function routeIntent(q) {
      const qq = norm(q);
      const has = (...words) => words.some(w => qq.includes(norm(w)));
      if (has("wallet", "portefeuille") && has("ajout", "ajouter", "creer", "nouveau", "nouvelle", "create", "add")) return t("assistant.intent.wallet_create");
      if (has("renomm", "rename", "nom") && has("voyage", "periode", "trip", "period")) return t("assistant.intent.voyage_rename");
      if (has("categ", "cateo", "cat", "category", "subcategory", "sous categorie", "sous-categorie") && has("creer", "ajout", "ajouter", "nouveau", "nouvelle", "create", "add")) return t("assistant.intent.category_create");
      if (has("document", "passeport", "visa", "expiration", "renouvellement")) return t("assistant.intent.documents");
      if (has("patrimoine", "asset", "actif", "vente", "coproprietaire", "amortissement")) return t("assistant.intent.assets");
      if (has("analyse", "budget source", "reference", "mapping", "categorie")) return t("assistant.intent.analysis");
      if (has("recurrence", "echeance", "abonnement", "salaire", "mensuel")) return t("assistant.intent.recurring");
      if (has("partage", "split", "participant", "remboursement")) return t("assistant.intent.trip");
      if (has("analyse rapide", "resume", "resumer", "situation", "point", "diagnostic", "quick analysis", "summary", "status")) return quickAnalysisText();
      return "";
    }

    function handleSend() {
      const input = document.getElementById("tb-assist-input");
      const q = (input && input.value || "").trim();
      if (!q) return;
      if (input) input.value = "";
      appendMsg("user", q);
      const intent = routeIntent(q);
      if (intent) { appendMsg("bot", intent); return; }
      const hits = (window.tbSearchFaq ? tbSearchFaq(q, 1) : []);
      if (!hits || !hits.length) { appendMsg("bot", t("assistant.no_match")); return; }
      const best = hits[0];
      appendMsg("bot", (best.a && best.a[lang()]) || t("assistant.no_match"));
    }

    panel.querySelector("#tb-assist-send")?.addEventListener("click", handleSend);
    panel.querySelector("#tb-assist-input")?.addEventListener("keydown", e => { if (e.key === "Enter") handleSend(); });
    if (isOpenPersisted()) setTimeout(() => { try { openPanel(); } catch (_) {} }, 50);

    try {
      if (window.tbBus && typeof tbBus.on === "function") {
        const refresh = () => { try { if (!panel.classList.contains("hidden")) renderContext(); } catch (_) {} };
        tbBus.on("refresh:done", refresh);
        tbBus.on("fx:updated", refresh);
        tbBus.on("periods:changed", refresh);
        tbBus.on("boot:paint", refresh);
        tbBus.on("view:changed", refresh);
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureDom);
  else ensureDom();
})();

