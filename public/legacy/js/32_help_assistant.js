/* =========================
   Help Assistant (V1)
   - Offline mini assistant: searches FAQ entries
   - Floating button + panel
   - Lazy: DOM created on first open
   ========================= */

(function () {
  function t(k) { return (window.tbT ? tbT(k) : k); }
  function lang() { return (window.tbGetLang && tbGetLang()) || "fr"; }

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

    function openPanel() {
      panel.classList.remove("hidden");
      const input = document.getElementById("tb-assist-input");
      if (input) input.focus();
    }
    function closePanel() {
      panel.classList.add("hidden");
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

    function appendMsg(role, text) {
      const thread = document.getElementById("tb-assist-thread");
      if (!thread) return;
      const div = document.createElement("div");
      div.className = "tb-assist-msg " + (role === "user" ? "user" : "bot");
      div.textContent = text;
      thread.appendChild(div);
      thread.scrollTop = thread.scrollHeight;
    }

    function handleSend() {
      const input = document.getElementById("tb-assist-input");
      const q = (input && input.value || "").trim();
      if (!q) return;
      if (input) input.value = "";
      appendMsg("user", q);

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

    // Initial welcome
    appendMsg("bot", t("assistant.hint"));
  }

  function init() {
    // lazy: only create on first interaction, but we still add a tiny button
    ensureDom();
  }

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
      // Update static labels; keep thread untouched
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
