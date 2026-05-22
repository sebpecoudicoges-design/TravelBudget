export function registerPwa() {
  if (typeof window === "undefined") return;

  const updateOnlineState = () => {
    try {
      document.documentElement.classList.toggle("tb-offline", !navigator.onLine);
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
      badge.style.display = navigator.onLine ? "none" : "block";
    } catch (_) {}
  };

  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateOnlineState);
  else updateOnlineState();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[PWA] service worker registration failed", err);
      });
    });
  }
}
