/* =========================
   Perf instrumentation (V6.6)
   - Enabled with ?perf=1
   - Lightweight marks/measures + grouped console output
   ========================= */
(function () {
  const qs = new URLSearchParams(location.search || "");
  const enabled = qs.get("perf") === "1" || qs.get("perf") === "true";

  const marks = Object.create(null);
  const spans = [];

  function now() {
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }

  function mark(name) {
    if (!enabled) return;
    marks[name] = now();
  }

  function end(name, startName) {
    if (!enabled) return;
    const t1 = now();
    const t0 = marks[startName || name];
    if (!isFinite(t0)) return;
    spans.push({ name, ms: +(t1 - t0).toFixed(1) });
    return t1 - t0;
  }

  function wrap(name, fn) {
    if (!enabled || typeof fn !== "function") return fn;
    return function (...args) {
      mark(name);
      try {
        const out = fn.apply(this, args);
        if (out && typeof out.then === "function") {
          return out.then((v) => { end(name); return v; }).catch((e) => { end(name); throw e; });
        }
        end(name);
        return out;
      } catch (e) {
        end(name);
        throw e;
      }
    };
  }

  function flush(label) {
    if (!enabled) return;
    try {
      const title = label ? `[TB PERF] ${label}` : "[TB PERF]";
      console.groupCollapsed(title);
      if (spans.length) console.table(spans);
      const total = spans.reduce((a, s) => a + (s.ms || 0), 0);
      console.log("Total (ms):", +total.toFixed(1));
      console.groupEnd();
    } catch (_) {}
  }

  // simple coalescing helpers (used by charts)
  let _idleId = null;
  function runIdle(fn, timeoutMs) {
    if (typeof fn !== "function") return;
    const t = Math.max(0, Number(timeoutMs || 800));
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      return ric(fn, { timeout: t });
    }
    return setTimeout(fn, 0);
  }
  function cancelIdle(id) {
    const cic = window.cancelIdleCallback;
    if (typeof cic === "function") return cic(id);
    clearTimeout(id);
  }
  function coalesceIdle(fn, timeoutMs) {
    if (!enabled) {
      // even without perf flag, we still prefer not to block UI for heavy charts:
      // keep coalescing behavior (but without logs)
    }
    if (_idleId) cancelIdle(_idleId);
    _idleId = runIdle(() => {
      _idleId = null;
      try { fn(); } catch (e) { console.warn("[TB] idle task failed:", e); }
    }, timeoutMs);
  }

  window.TB_PERF = {
    enabled,
    mark,
    end,
    wrap,
    flush,
    now
  };

  window.TB_DEFER = {
    runIdle,
    coalesceIdle
  };

  // mark as early as possible
  mark("boot:script_start");
})();
