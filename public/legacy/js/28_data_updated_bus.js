/* =========================
   App Event Bus (V4.1)
   - typed events + backwards compatible "data:updated"
   - avoids implicit refresh cascades
   ========================= */
(function () {
  const LEGACY = "data:updated";
  const PREFIX = "tb:";
  const MAX_QUEUE = 40;

  // Minimal in-memory trace for debugging (no PII)
  const trace = [];
  function pushTrace(name, detail) {
    try {
      trace.push({ t: Date.now(), name, detail: detail ? Object.keys(detail).slice(0, 12) : null });
      while (trace.length > MAX_QUEUE) trace.shift();
    } catch (_) {}
  }

  function emit(name, detail) {
    try {
      window.__TB_DATA_REV = (Number(window.__TB_DATA_REV || 0) + 1);
      window.__TB_DATA_UPDATED_AT = Date.now();
    } catch (_) {}
    const full = name.startsWith(PREFIX) ? name : (PREFIX + name);
    pushTrace(full, detail);
    document.dispatchEvent(new CustomEvent(full, { detail: detail || {} }));
    // Legacy generic event for existing listeners
    document.dispatchEvent(new Event(LEGACY));
  }

  function on(name, handler) {
    const full = name.startsWith(PREFIX) ? name : (PREFIX + name);
    document.addEventListener(full, (e) => handler(e.detail || {}, e));
  }

  // Expose
  window.tbBus = {
    emit,
    on,
    getTrace: () => trace.slice(),
    LEGACY,
    PREFIX,
  };

  // Backward compatible alias
  window.emitDataUpdated = function () { emit("data:updated"); };

  // Wrap key functions (best-effort, non-fatal)
  function wrapAsync(fnName, eventName) {
    const fn = window[fnName];
    if (typeof fn !== "function") return;
    window[fnName] = async function () {
      const r = await fn.apply(this, arguments);
      emit(eventName, { fn: fnName });
      return r;
    };
  }

  wrapAsync("refreshFromServer", "refresh:done");
  wrapAsync("refreshFxRates", "fx:updated");

  // First paint fallback
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => emit("boot:paint"), 300);
  });
})();
