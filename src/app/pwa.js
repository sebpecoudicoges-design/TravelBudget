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
      const appOffline = (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode())
        || (navigator && navigator.onLine === false);
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
      badge.textContent = lang.startsWith("en") ? "Offline mode - local data" : "Mode hors ligne - donnees locales";
      if (offlineBadgeTimer) {
        clearTimeout(offlineBadgeTimer);
        offlineBadgeTimer = null;
      }
      if (appOffline) {
        offlineBadgeTimer = setTimeout(() => {
          try {
            const stillOffline = (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode())
              || (navigator && navigator.onLine === false);
            badge.style.display = stillOffline ? "block" : "none";
          } catch (_) {}
        }, 1800);
      } else {
        badge.style.display = "none";
      }
    } catch (_) {}
  };

  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  window.addEventListener("tb:offline_state_changed", updateOnlineState);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateOnlineState);
  else updateOnlineState();

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
