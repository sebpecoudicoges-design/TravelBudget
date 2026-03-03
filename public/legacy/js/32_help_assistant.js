/* =========================
   Help Assistant (V6.6.90)
   - Offline mini assistant: searches FAQ entries
   - Floating button + panel
   - Persistence (thread + open state) in localStorage
   - Context pack + quick actions (no AI, free)
   ========================= */
(function () {
  function t(k) { return (window.tbT ? tbT(k) : k); }
  function lang() { return (window.tbGetLang && tbGetLang()) || "fr"; }

  function _k(keyFallback) {
    try { return (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS[keyFallback]) ? TB_CONST.LS_KEYS[keyFallback] : null; } catch (_) {}
    return null;
  }

  const LS_THREAD = (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.assist_thread) || "travelbudget_assist_thread_v1";
  const LS_OPEN   = (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.assist_open)   || "travelbudget_assist_open_v1";

  function loadThread() {
    try {
      const raw = localStorage.getItem(LS_THREAD);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(Boolean).slice(-80) : [];
    } catch (_) { return []; }
  }

  function saveThread(arr) {
    try { localStorage.setItem(LS_THREAD, JSON.stringify((arr || []).slice(-80))); } catch (_) {}
  }

  function isOpenPersisted() {
    try { return localStorage.getItem(LS_OPEN) === "1"; } catch (_) { return false; }
  }

  function setOpenPersisted(v) {
    try { localStorage.setItem(LS_OPEN, v ? "1" : "0"); } catch (_) {}
  }

  function _periodName() {
    try {
      const pid = String(window.state?.period?.id || "");
      if (pid && typeof window.tbGetPeriodName === "function") {
        const nm = window.tbGetPeriodName(pid);
        if (nm) return nm;
      }
    } catch (_) {}
    return "Voyage";
  }

  function buildContextPack() {
    try {
      const p = window.state?.period || {};
      const seg = (typeof window.getBudgetSegmentForDate === "function")
        ? window.getBudgetSegmentForDate((typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : (window.toLocalISODate ? toLocalISODate(new Date()) : new Date().toISOString().slice(0,10)))
        : null;

      const name = _periodName();
      const start = String(p.start || "").slice(0,10);
      const end   = String(p.end || "").slice(0,10);

      // FX status (Option A)
      const eurAsOf = (() => {
        try { return localStorage.getItem((TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.eur_rates_asof) || "travelbudget_fx_eur_rates_asof_v1") || ""; } catch (_) { return ""; }
      })();
      const refDay = (typeof window.tbFxRefDay === "function") ? String(window.tbFxRefDay() || "") : "";
      const count = (() => {
        try {
          const k = (TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.eur_rates_keys) || "travelbudget_fx_eur_rates_keys_v1";
          return JSON.parse(localStorage.getItem(k) || "[]").length;
        } catch (_) { return 0; }
      })();

      const segStr = seg ? `${String(seg.start||"").slice(0,10)} → ${String(seg.end||"").slice(0,10)} (${String(seg.baseCurrency||"").toUpperCase()})` : "—";

      const stale = (eurAsOf && refDay) ? (String(eurAsOf) < String(refDay)) : false;
      const fxLine = eurAsOf ? `ECB: ${eurAsOf}${stale ? " (stale)" : ""} • ${count} devises • refDay ${refDay || "—"}` : `ECB: — • refDay ${refDay || "—"}`;

      return [
        { k: "Voyage", v: `${name}${(start&&end)?` • ${start} → ${end}`:""}` },
        { k: "Segment", v: segStr },
        { k: "FX", v: fxLine },
      ];
    } catch (_) {
      return [];
    }
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
        <div class="tb-assist-title">${t("assistant.title")}</div>
        <div class="tb-assist-actions">
          <button type="button" class="tb-assist-link" id="tb-assist-open-faq">${t("assistant.suggest_faq")}</button>
          <button type="button" class="tb-assist-x" id="tb-assist-close" aria-label="${t("assistant.close")}">✕</button>
        </div>
      </div>

      <div class="tb-assist-body">
        <div id="tb-assist-context" style="margin-bottom:10px; padding:10px; border:1px solid rgba(0,0,0,0.08); border-radius:14px; background:rgba(0,0,0,0.02);">
          <div class="muted" style="font-size:12px; font-weight:700; margin-bottom:6px;">${t("assistant.context_title")}</div>
          <div id="tb-assist-context-lines" class="muted" style="font-size:12px; line-height:1.35;"></div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            <button type="button" class="btn" id="tb-assist-go-settings" style="padding:6px 10px; font-size:12px;">${t("assistant.action.settings")}</button>
            <button type="button" class="btn" id="tb-assist-go-wallets" style="padding:6px 10px; font-size:12px;">${t("assistant.action.wallets")}</button>
            <button type="button" class="btn" id="tb-assist-go-help" style="padding:6px 10px; font-size:12px;">${t("assistant.action.help")}</button>
            <button type="button" class="btn" id="tb-assist-go-tx" style="padding:6px 10px; font-size:12px;">${t("assistant.action.transactions")}</button>
          </div>
        </div>

        <div class="tb-assist-hint">${t("assistant.hint")}</div>
        <div id="tb-assist-thread" class="tb-assist-thread"></div>
      </div>

      <div class="tb-assist-foot">
        <input id="tb-assist-input" class="tb-assist-input" type="text" placeholder="${t("assistant.placeholder")}" />
        <button id="tb-assist-send" class="tb-assist-send" type="button">${t("assistant.send")}</button>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    function renderContext() {
      const linesEl = document.getElementById("tb-assist-context-lines");
      if (!linesEl) return;
      const lines = buildContextPack();
      linesEl.innerHTML = lines.map(x => `<div><strong style="color:var(--text);">${String(x.k||"")}</strong> : ${String(x.v||"")}</div>`).join("");
    }

    function openPanel() {
      panel.classList.remove("hidden");
      setOpenPersisted(true);
      renderContext();
      const input = document.getElementById("tb-assist-input");
      if (input) input.focus();
    }
    function closePanel() {
      panel.classList.add("hidden");
      setOpenPersisted(false);
    }

    btn.addEventListener("click", () => {
      if (panel.classList.contains("hidden")) openPanel();
      else closePanel();
    });

    panel.querySelector("#tb-assist-close")?.addEventListener("click", closePanel);
    panel.querySelector("#tb-assist-open-faq")?.addEventListener("click", () => {
      try {
        if (typeof showView === "function") showView("help");
        closePanel();
      } catch (_) {}
    });

    panel.querySelector("#tb-assist-go-settings")?.addEventListener("click", () => { try { if (typeof showView === "function") showView("settings"); } catch (_) {} });
    // Wallets are managed from Dashboard.
    panel.querySelector("#tb-assist-go-wallets")?.addEventListener("click", () => {
      try {
        if (typeof showView === "function") showView("dashboard");
        setTimeout(() => {
          try {
            const el = document.getElementById("wallets-container");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch (_) {}
        }, 80);
      } catch (_) {}
    });
    panel.querySelector("#tb-assist-go-help")?.addEventListener("click", () => { try { if (typeof showView === "function") showView("help"); } catch (_) {} });
    panel.querySelector("#tb-assist-go-tx")?.addEventListener("click", () => { try { if (typeof showView === "function") showView("transactions"); } catch (_) {} });

    const threadData = loadThread();

    function appendMsg(role, text, persist=true) {
      const thread = document.getElementById("tb-assist-thread");
      if (!thread) return;
      const div = document.createElement("div");
      div.className = "tb-assist-msg " + (role === "user" ? "user" : "bot");
      div.textContent = text;
      thread.appendChild(div);
      thread.scrollTop = thread.scrollHeight;

      if (persist) {
        threadData.push({ role: role === "user" ? "user" : "bot", text: String(text || ""), t: Date.now() });
        saveThread(threadData);
      }
    }

    // Restore thread
    if (threadData.length) {
      threadData.forEach(m => appendMsg(m.role, m.text, false));
    } else {
      appendMsg("bot", t("assistant.hint"), true);
    }

    function handleSend() {
      const input = document.getElementById("tb-assist-input");
      const q = (input && input.value || "").trim();
      if (!q) return;
      if (input) input.value = "";
      appendMsg("user", q);

      // Lightweight intent routing (offline, no AI)
      // Wallet creation is a common action: don't rely on FAQ fuzzy search.
      try {
        const qq = q.toLowerCase();
        const wantsWallet = (qq.includes("wallet") || qq.includes("portefeuille")) && (qq.includes("ajout") || qq.includes("ajouter") || qq.includes("créer") || qq.includes("creer") || qq.includes("nouveau") || qq.includes("nouvelle"));
        if (wantsWallet) {
          appendMsg("bot", t("assistant.intent.wallet_create"));
          return;
        }

        const wantsRename = (qq.includes("renomm") || qq.includes("rename") || qq.includes("nom")) && (qq.includes("voyage") || qq.includes("periode") || qq.includes("période") || qq.includes("trip") || qq.includes("period"));
        if (wantsRename) {
          appendMsg("bot", t("assistant.intent.voyage_rename"));
          return;
        }
      } catch (_) {}

      const hits = (window.tbSearchFaq ? tbSearchFaq(q, 1) : []);
      const l = lang();
      if (!hits || hits.length === 0) {
        appendMsg("bot", t("assistant.no_match"));
        return;
      }
      const best = hits[0];
      const answer = (best.a && best.a[l]) || "";
      appendMsg("bot", answer);
    }

    panel.querySelector("#tb-assist-send")?.addEventListener("click", handleSend);
    panel.querySelector("#tb-assist-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });

    // Auto open if persisted
    if (isOpenPersisted()) {
      setTimeout(() => { try { openPanel(); } catch (_) {} }, 50);
    }

    // Update context pack on key app events (no spam)
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

  function init() { ensureDom(); }

  // Delay init to avoid any boot impact
  const doInit = () => { try { init(); } catch (_) {} };
  if (window.requestIdleCallback) requestIdleCallback(doInit, { timeout: 2000 });
  else setTimeout(doInit, 500);

  // Repaint titles when language changes
  window.tbOnLangChange = window.tbOnLangChange || [];
  window.tbOnLangChange.push(() => {
    const btn = document.getElementById("tb-assist-btn");
    const panel = document.getElementById("tb-assist-panel");
    if (btn) btn.title = t("assistant.title");
    if (panel) {
      const title = panel.querySelector(".tb-assist-title");
      if (title) title.textContent = t("assistant.title");
      const hint = panel.querySelector(".tb-assist-hint");
      if (hint) hint.textContent = t("assistant.hint");
      const openFaq = panel.querySelector("#tb-assist-open-faq");
      if (openFaq) openFaq.textContent = t("assistant.suggest_faq");
      const send = panel.querySelector("#tb-assist-send");
      if (send) send.textContent = t("assistant.send");
      const input = panel.querySelector("#tb-assist-input");
      if (input) input.placeholder = t("assistant.placeholder");
    }
  });
})();