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

      setText("#modal-title", "Transaction", "Transaction");
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

      const cancel = document.querySelector("#modal .modal-actions .btn:not(.primary)");
      if (cancel) cancel.textContent = lang === "en" ? "Cancel" : "Annuler";
      const save = document.querySelector("#modal .modal-actions .btn.primary");
      if (save && !save.disabled) save.textContent = lang === "en" ? "Save" : "Enregistrer";
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
