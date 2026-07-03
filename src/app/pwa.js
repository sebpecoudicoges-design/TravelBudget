export function registerPwa() {
  if (typeof window === "undefined") return;
  let offlineBadgeTimer = null;

  const collectCacheUrls = () => {
    const urls = new Set([
      "/",
      "/index.html",
      "/offline.html",
      "/manifest.webmanifest",
      "/favicon.ico",
      "/pwa-icon.svg",
    ]);
    try {
      document.querySelectorAll("script[src],link[href]").forEach((el) => {
        const raw = el.getAttribute("src") || el.getAttribute("href") || "";
        if (raw) urls.add(new URL(raw, window.location.origin).toString());
      });
      performance.getEntriesByType("resource").forEach((entry) => {
        const name = String(entry?.name || "");
        if (!name) return;
        const url = new URL(name, window.location.origin);
        if (url.origin === window.location.origin || url.hostname === "cdn.jsdelivr.net") urls.add(url.toString());
      });
    } catch (_) {}
    return Array.from(urls);
  };

  const requestCacheWarmup = async (registration) => {
    try {
      const ready = registration || await navigator.serviceWorker.ready;
      const worker = ready?.active || navigator.serviceWorker.controller || ready?.waiting || ready?.installing;
      if (!worker) return;
      worker.postMessage({ type: "TB_CACHE_URLS", urls: collectCacheUrls() });
    } catch (_) {}
  };

  const queueLang = () => {
    try {
      const lang = String(window.__tbLang || localStorage.getItem("tb_lang_v1") || navigator.language || "fr").toLowerCase();
      return lang.startsWith("en") ? "en" : "fr";
    } catch (_) {
      return "fr";
    }
  };

  const queueText = (fr, en) => queueLang() === "en" ? en : fr;

  const queueItemLabel = (item) => {
    try {
      const kind = String(item?.kind || "");
      const meta = item?.meta || {};
      const label = String(meta.label || "").trim();
      const amount = meta.amount != null ? String(meta.amount) : "";
      const currency = String(meta.currency || "").trim();
      if (kind === "transaction.apply_v2") {
        const base = label || queueText("Transaction", "Transaction");
        const amt = amount ? ` - ${amount}${currency ? ` ${currency}` : ""}` : "";
        return `${base}${amt}`;
      }
      if (kind === "sport.sync_local") return queueText("Seance sport", "Sport session");
      return queueText("Action hors ligne", "Offline action");
    } catch (_) {
      return queueText("Action hors ligne", "Offline action");
    }
  };

  const ensurePendingQueueUi = () => {
    try {
      const count = typeof window.tbOfflineQueueCount === "function" ? Number(window.tbOfflineQueueCount() || 0) : 0;
      let chip = document.getElementById("tb-offline-queue-chip");
      if (!count) {
        if (chip) chip.style.display = "none";
        const panel = document.getElementById("tb-offline-queue-panel");
        if (panel) panel.style.display = "none";
        return;
      }
      if (!chip) {
        chip = document.createElement("button");
        chip.id = "tb-offline-queue-chip";
        chip.type = "button";
        chip.style.cssText = [
          "position:fixed",
          "right:14px",
          "top:82px",
          "z-index:99997",
          "border:1px solid rgba(37,99,235,.22)",
          "border-radius:999px",
          "background:rgba(255,255,255,.94)",
          "color:#0f172a",
          "box-shadow:0 14px 42px rgba(15,23,42,.16)",
          "padding:8px 11px",
          "font:900 12px system-ui,-apple-system,Segoe UI,Roboto,Arial",
          "display:none",
          "align-items:center",
          "gap:7px",
          "backdrop-filter:blur(14px)"
        ].join(";");
        chip.addEventListener("click", () => {
          const panel = ensurePendingPanel();
          if (panel) panel.style.display = panel.style.display === "block" ? "none" : "block";
        });
        document.body.appendChild(chip);
      }
      chip.innerHTML = `<span style="width:8px;height:8px;border-radius:999px;background:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12);"></span>${queueText(`${count} en attente`, `${count} pending`)}`;
      chip.style.display = "inline-flex";
      const panel = document.getElementById("tb-offline-queue-panel");
      if (panel && panel.style.display === "block") renderPendingPanel(panel);
    } catch (_) {}
  };

  const renderPendingPanel = (panel) => {
    try {
      const items = typeof window.tbOfflineQueuePending === "function" ? window.tbOfflineQueuePending() : [];
      const rows = (items || []).slice(0, 8).map((item) => `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-top:1px solid rgba(15,23,42,.08);">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(queueItemLabel(item))}</span>
          <small style="color:#64748b;font-weight:800;">${escapeHtml(String(item?.status || "pending"))}</small>
        </div>
      `).join("");
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px;">
          <strong>${escapeHtml(queueText("Actions en attente", "Pending actions"))}</strong>
          <button type="button" data-tb-queue-close style="border:0;background:transparent;font:900 18px system-ui;color:#64748b;">x</button>
        </div>
        <p style="margin:0 0 10px;color:#64748b;font-size:12px;line-height:1.45;">${escapeHtml(queueText("Elles seront envoyees automatiquement au retour reseau.", "They will sync automatically when the connection returns."))}</p>
        ${rows || `<div style="color:#64748b;font-size:13px;">${escapeHtml(queueText("Aucune action en attente.", "No pending action."))}</div>`}
        <button type="button" data-tb-queue-sync style="width:100%;margin-top:12px;border:0;border-radius:999px;background:linear-gradient(135deg,#0f172a,#2563eb);color:#fff;padding:10px 12px;font:900 13px system-ui;">${escapeHtml(queueText("Synchroniser maintenant", "Sync now"))}</button>
      `;
      panel.querySelector("[data-tb-queue-close]")?.addEventListener("click", () => { panel.style.display = "none"; });
      panel.querySelector("[data-tb-queue-sync]")?.addEventListener("click", async (ev) => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        btn.textContent = queueText("Synchronisation...", "Syncing...");
        try {
          if (typeof window.tbOfflineQueueSync === "function") await window.tbOfflineQueueSync("manual");
        } catch (e) {
          console.warn("[OfflineQueue] manual sync failed", e?.message || e);
        } finally {
          btn.disabled = false;
          ensurePendingQueueUi();
        }
      });
    } catch (_) {}
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));

  const ensurePendingPanel = () => {
    try {
      let panel = document.getElementById("tb-offline-queue-panel");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "tb-offline-queue-panel";
        panel.style.cssText = [
          "position:fixed",
          "right:14px",
          "top:124px",
          "z-index:99997",
          "width:min(340px,calc(100vw - 28px))",
          "max-height:min(420px,calc(100vh - 156px))",
          "overflow:auto",
          "display:none",
          "border:1px solid rgba(15,23,42,.10)",
          "border-radius:18px",
          "background:rgba(255,255,255,.98)",
          "box-shadow:0 22px 70px rgba(15,23,42,.22)",
          "padding:14px",
          "color:#0f172a",
          "font:800 13px system-ui,-apple-system,Segoe UI,Roboto,Arial",
          "backdrop-filter:blur(18px)"
        ].join(";");
        document.body.appendChild(panel);
      }
      renderPendingPanel(panel);
      return panel;
    } catch (_) {
      return null;
    }
  };

  const updateOnlineState = () => {
    try {
      const networkOffline = !!(navigator && navigator.onLine === false);
      const restoredOffline = !!document.documentElement.classList.contains("tb-offline-restored");
      const appOffline = networkOffline || restoredOffline;
      document.documentElement.classList.toggle("tb-offline", !!appOffline);
      let badge = document.getElementById("tb-offline-badge");
      if (!badge) {
        badge = document.createElement("div");
        badge.id = "tb-offline-badge";
        badge.setAttribute("role", "status");
        badge.style.cssText = [
          "position:fixed",
          "left:50%",
          "bottom:18px",
          "transform:translateX(-50%)",
          "z-index:99998",
          "padding:10px 14px",
          "border-radius:999px",
          "background:#111827",
          "color:#fff",
          "box-shadow:0 18px 48px rgba(15,23,42,.28)",
          "font:800 13px system-ui,-apple-system,Segoe UI,Roboto,Arial",
          "display:none"
        ].join(";");
        document.body.appendChild(badge);
      }
      const lang = String(window.__tbLang || localStorage.getItem("tb_lang_v1") || navigator.language || "fr").toLowerCase();
      const queueCount = typeof window.tbOfflineQueueCount === "function" ? Number(window.tbOfflineQueueCount() || 0) : 0;
      badge.textContent = queueCount > 0
        ? (lang.startsWith("en") ? `Offline - ${queueCount} pending sync` : `Hors ligne - ${queueCount} synchro en attente`)
        : (lang.startsWith("en") ? "Offline mode - local data" : "Mode hors ligne - donnees locales");
      if (offlineBadgeTimer) {
        clearTimeout(offlineBadgeTimer);
        offlineBadgeTimer = null;
      }
      if (networkOffline) {
        offlineBadgeTimer = setTimeout(() => {
          try {
            const stillOffline = !!(navigator && navigator.onLine === false);
            badge.style.display = stillOffline ? "block" : "none";
            if (stillOffline) {
              offlineBadgeTimer = setTimeout(() => {
                try { badge.style.display = "none"; } catch (_) {}
              }, 4500);
            }
          } catch (_) {}
        }, 2200);
      } else {
        badge.style.display = "none";
      }
      ensurePendingQueueUi();
    } catch (_) {}
  };

  const ensureMobileNav = () => {
    try {
      if (document.getElementById("tb-mobile-nav-toggle")) return;
      const header = document.querySelector("header");
      const tabs = document.querySelector(".tabs, .app-tabs");
      if (!header || !tabs) return;
      const btn = document.createElement("button");
      btn.id = "tb-mobile-nav-toggle";
      btn.className = "btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Menu");
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<span></span><span></span><span></span>';
      btn.addEventListener("click", () => {
        const open = !document.body.classList.contains("tb-mobile-nav-open");
        document.body.classList.toggle("tb-mobile-nav-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      tabs.addEventListener("click", (ev) => {
        if (ev.target && ev.target.closest && ev.target.closest(".tab")) {
          document.body.classList.remove("tb-mobile-nav-open");
          btn.setAttribute("aria-expanded", "false");
        }
      });
      document.addEventListener("click", (ev) => {
        const target = ev.target;
        if (!document.body.classList.contains("tb-mobile-nav-open")) return;
        if (target && target.closest && (target.closest("#tb-mobile-nav-toggle") || target.closest(".tabs, .app-tabs"))) return;
        document.body.classList.remove("tb-mobile-nav-open");
        btn.setAttribute("aria-expanded", "false");
      });
      document.body.appendChild(btn);
    } catch (_) {}
  };

  const getLang = () => {
    try {
      const lang = String(
        (typeof window.tbGetLang === "function" ? window.tbGetLang() : "")
        || window.__tbLang
        || localStorage.getItem("tb_lang_v1")
        || navigator.language
        || "fr"
      ).toLowerCase();
      return lang.startsWith("en") ? "en" : "fr";
    } catch (_) {
      return "fr";
    }
  };

  const setText = (selector, fr, en) => {
    try {
      const el = document.querySelector(selector);
      if (el) el.textContent = getLang() === "en" ? en : fr;
    } catch (_) {}
  };

  const setLabelFor = (id, fr, en) => {
    try {
      const el = document.getElementById(id);
      const field = el?.closest?.(".field");
      const label = field?.querySelector?.("label");
      if (!label) return;
      const help = label.querySelector(".tb-help");
      label.textContent = getLang() === "en" ? en : fr;
      if (help) {
        label.appendChild(document.createTextNode(" "));
        label.appendChild(help);
      }
    } catch (_) {}
  };

  const applyMobileCopy = () => {
    try {
      if (!document.body.classList.contains("tb-capacitor-app")) return;
      const lang = getLang();
      document.body.dataset.tbMobileLang = lang;

      setText(".top-actions > button:nth-of-type(1)", "Theme", "Theme");
      setText(".top-actions > button:nth-of-type(2)", "Taux", "Rates");
      setText(".top-actions > button:nth-of-type(5)", "Sortir", "Logout");

      setLabelFor("m-type", "Type", "Type");
      setLabelFor("m-wallet", "Wallet", "Wallet");
      setLabelFor("m-amount", "Montant", "Amount");
      setLabelFor("m-category", "Categorie", "Category");
      setLabelFor("m-subcategory", "Sous-cat.", "Subcat.");
      setLabelFor("m-cash-date", "Tresorerie", "Cash date");
      setLabelFor("m-budget-start", "Budget debut", "Budget start");
      setLabelFor("m-budget-end", "Budget fin", "Budget end");
      setLabelFor("m-label", "Note", "Note");
      setLabelFor("m-paynow", "Paye maintenant", "Paid now");
      setLabelFor("m-out", "Hors budget", "Out of budget");
      setLabelFor("m-night", "Remplace nuit", "Replaces night");

    } catch (_) {}
  };

  const markRuntimeMode = () => {
    try {
      const isCapacitor = !!window.Capacitor
        || String(window.location?.protocol || "").startsWith("capacitor")
        || !!document.querySelector('html[data-capacitor], body[data-capacitor]');
      document.body.classList.toggle("tb-capacitor-app", !!isCapacitor);
      if (!document.body.dataset.tbView) {
        const activeTab = document.querySelector(".app-tabs .tab.active, .tabs .tab.active");
        const id = String(activeTab?.id || "").replace(/^tab-/, "");
        document.body.dataset.tbView = id || "dashboard";
        document.body.classList.toggle("tb-view-dashboard", (id || "dashboard") === "dashboard");
      }
      applyMobileCopy();
    } catch (_) {}
  };

  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  window.addEventListener("tb:offline_state_changed", updateOnlineState);
  window.addEventListener("tb:offline_queue_changed", updateOnlineState);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      markRuntimeMode();
      updateOnlineState();
      ensureMobileNav();
      applyMobileCopy();
    });
  } else {
    markRuntimeMode();
    updateOnlineState();
    ensureMobileNav();
    applyMobileCopy();
  }

  document.addEventListener("click", () => setTimeout(applyMobileCopy, 30), true);
  window.addEventListener("tb:language_changed", applyMobileCopy);
  window.addEventListener("languagechange", applyMobileCopy);
  setInterval(applyMobileCopy, 1200);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          requestCacheWarmup(registration);
          setTimeout(() => requestCacheWarmup(registration), 2500);
          setTimeout(() => requestCacheWarmup(registration), 8000);
        })
        .catch((err) => {
          console.warn("[PWA] service worker registration failed", err);
        });
    });
  }
}
