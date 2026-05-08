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

  function buildContextPack() {
    try {
      const p = window.state?.period || {};
      const start = String(p.start || "").slice(0,10);
      const end = String(p.end || "").slice(0,10);
      const seg = (typeof window.getBudgetSegmentForDate === "function")
        ? window.getBudgetSegmentForDate((typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : new Date().toISOString().slice(0,10))
        : null;
      const segStr = seg ? `${String(seg.start||"").slice(0,10)} → ${String(seg.end||"").slice(0,10)} (${String(seg.baseCurrency||"").toUpperCase()})` : "—";
      const eurAsOf = (() => { try { return localStorage.getItem((TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.eur_rates_asof) || "travelbudget_fx_eur_rates_asof_v1") || ""; } catch (_) { return ""; } })();
      const refDay = (typeof window.tbFxRefDay === "function") ? String(window.tbFxRefDay() || "") : "";
      const stale = (eurAsOf && refDay) ? (String(eurAsOf) < String(refDay)) : false;
      const fxLine = eurAsOf ? (stale ? t("assistant.context.fx_stale") : t("assistant.context.fx_ok")) : t("assistant.context.fx_missing");
      return [
        { k: t("assistant.context.trip"), v: `${_periodName()}${(start&&end)?` • ${start} → ${end}`:""}` },
        { k: t("assistant.context.period"), v: segStr },
        { k: "FX", v: fxLine },
        { k: t("assistant.context.modules"), v: `${countState("transactions")} tx • ${countState("wallets")} wallets • ${countState("documents")} docs • ${countState("assets")} assets` }
      ];
    } catch (_) { return []; }
  }

  function go(view, target) {
    try { if (typeof showView === "function") showView(view); } catch (_) {}
    if (target) setTimeout(() => { try { const el = document.querySelector(target); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {} }, 80);
  }

  function ensureDom() {
    if (document.getElementById("tb-assist-btn")) return;
    const btn = document.createElement("button");
    btn.id = "tb-assist-btn";
    btn.className = "tb-assist-btn";
    btn.type = "button";
    btn.innerHTML = "💬";
    btn.title = t("assistant.title");

    const panel = document.createElement("div");
    panel.id = "tb-assist-panel";
    panel.className = "tb-assist-panel hidden";
    panel.innerHTML = `
      <div class="tb-assist-head">
        <div class="tb-assist-title">${esc(t("assistant.title"))}</div>
        <div class="tb-assist-actions">
          <button type="button" class="tb-assist-link" id="tb-assist-open-faq">${esc(t("assistant.suggest_faq"))}</button>
          <button type="button" class="tb-assist-x" id="tb-assist-close" aria-label="${esc(t("assistant.close"))}">✕</button>
        </div>
      </div>
      <div class="tb-assist-body">
        <div id="tb-assist-context" style="margin-bottom:10px; padding:10px; border:1px solid rgba(0,0,0,0.08); border-radius:14px; background:rgba(0,0,0,0.02);">
          <div class="muted" style="font-size:12px; font-weight:700; margin-bottom:6px;">${esc(t("assistant.context_title"))}</div>
          <div id="tb-assist-context-lines" class="muted" style="font-size:12px; line-height:1.35;"></div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            <button type="button" class="btn" data-assist-view="settings" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.settings"))}</button>
            <button type="button" class="btn" data-assist-view="dashboard" data-assist-target="#wallets-container" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.wallets"))}</button>
            <button type="button" class="btn" data-assist-view="transactions" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.transactions"))}</button>
            <button type="button" class="btn" data-assist-view="analysis" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.analysis"))}</button>
            <button type="button" class="btn" data-assist-view="documents" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.documents"))}</button>
            <button type="button" class="btn" data-assist-view="assets" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.assets"))}</button>
            <button type="button" class="btn" data-assist-view="trip" style="padding:6px 10px; font-size:12px;">${esc(t("assistant.action.trip"))}</button>
          </div>
        </div>
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
      linesEl.innerHTML = buildContextPack().map(x => `<div><strong style="color:var(--text);">${esc(x.k)}</strong> : ${esc(x.v)}</div>`).join("");
    }
    function openPanel() { panel.classList.remove("hidden"); setOpenPersisted(true); renderContext(); document.getElementById("tb-assist-input")?.focus(); }
    function closePanel() { panel.classList.add("hidden"); setOpenPersisted(false); }
    btn.addEventListener("click", () => panel.classList.contains("hidden") ? openPanel() : closePanel());
    panel.querySelector("#tb-assist-close")?.addEventListener("click", closePanel);
    panel.querySelector("#tb-assist-open-faq")?.addEventListener("click", () => { go("help"); closePanel(); });
    panel.addEventListener("click", ev => {
      const b = ev.target && ev.target.closest && ev.target.closest("[data-assist-view]");
      if (!b) return;
      go(b.getAttribute("data-assist-view"), b.getAttribute("data-assist-target"));
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
      if (has("wallet", "portefeuille") && has("ajout", "ajouter", "créer", "creer", "nouveau", "nouvelle")) return t("assistant.intent.wallet_create");
      if (has("renomm", "rename", "nom") && has("voyage", "periode", "période", "trip", "period")) return t("assistant.intent.voyage_rename");
      if (has("document", "passeport", "visa", "expiration", "renouvellement")) return t("assistant.intent.documents");
      if (has("patrimoine", "asset", "actif", "vente", "copropriétaire", "coproprietaire", "amortissement")) return t("assistant.intent.assets");
      if (has("analyse", "budget sourcé", "reference", "référence", "mapping", "categorie", "catégorie")) return t("assistant.intent.analysis");
      if (has("récurrence", "recurrence", "échéance", "echeance", "abonnement", "salaire", "mensuel")) return t("assistant.intent.recurring");
      if (has("partage", "split", "participant", "remboursement")) return t("assistant.intent.trip");
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
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureDom);
  else ensureDom();
})();
