/* =========================
   Error Bus (V6.5)
   - Centralizes runtime errors (sync + async)
   - Provides a minimal UI for copying logs
   ========================= */
(function () {
  const MAX = 100;
  const _buf = [];

  function _toPlain(err) {
    try {
      if (!err) return { message: "Unknown error" };
      if (typeof err === "string") return { message: err };
      return {
        name: err.name,
        message: err.message || String(err),
        stack: err.stack,
        cause: err.cause ? String(err.cause) : undefined,
      };
    } catch (_) {
      return { message: "Unserializable error" };
    }
  }

  function push(entry) {
    try {
      _buf.push({ ts: new Date().toISOString(), ...entry });
      while (_buf.length > MAX) _buf.shift();
    } catch (_) {}
  }

  function get() {
    return _buf.slice();
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  function installGlobalHandlers() {
    window.addEventListener("error", (ev) => {
      push({
        type: "window.error",
        message: ev.message,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        error: _toPlain(ev.error),
      });
    });

    window.addEventListener("unhandledrejection", (ev) => {
      push({
        type: "unhandledrejection",
        reason: _toPlain(ev.reason),
      });
    });
  }

  window.__errorBus = Object.freeze({
    push,
    get,
    toPlain: _toPlain,
    copyToClipboard,
    installGlobalHandlers,
  });

  installGlobalHandlers();
})();
