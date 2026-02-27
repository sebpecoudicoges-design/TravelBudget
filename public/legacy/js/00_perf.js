/* =========================
   Perf instrumentation (V6.6)
   - Enabled with ?perf=1
   - Lightweight marks/measures + grouped console output
   ========================= */
(function () {
  const qs = new URLSearchParams(location.search || "");
  const enabled = (qs.get("perf") === "1" || qs.get("perf") === "true" || qs.get("perfect") === "1" || qs.get("perfect") === "true");

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
    if (typeof fn !== "function") return;
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

  // Coalesced render helpers (lightweight, safe if called before modules are loaded)
  (function(){
    let _renderReq = false;
    let _chartsReq = false;

    // "Boot gating": during the initial onload flow, we accumulate render requests and release once.
    let _bootPendingRender = false;
    let _bootPendingCharts = false;

    function _now(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }

    // Simple duplicate-call guard (same data rev + same view) within a short window
    let _lastRenderKey = "";
    let _lastRenderAt = 0;
    let _lastChartsKey = "";
    let _lastChartsAt = 0;

    function _makeKey(){
      const rev = (window.__TB_DATA_REV == null) ? "0" : String(window.__TB_DATA_REV);
      const hash = String(window.location && window.location.hash || "");
      const path = String(window.location && window.location.pathname || "");
      return rev + "|" + path + "|" + hash;
    }

    window.tbRequestRenderAll = window.tbRequestRenderAll || function(reason){
      // If we're booting, defer everything to the end of boot.
      if (window.__TB_BOOTING) { _bootPendingRender = true; return; }

      const k = _makeKey();
      const t = _now();
      if (k === _lastRenderKey && (t - _lastRenderAt) < 200) return;
      _lastRenderKey = k; _lastRenderAt = t;

      if (_renderReq) return;
      _renderReq = true;
      const sched = window.requestAnimationFrame || function(cb){ return setTimeout(cb, 0); };
      sched(function(){
        _renderReq = false;
        try { if (typeof window.renderAll === "function") return window.renderAll(); }
        catch (e) { console.warn("[TB] renderAll failed", e); }
      });
    };

    window.tbRequestRedrawCharts = window.tbRequestRedrawCharts || function(reason){
      if (window.__TB_BOOTING) { _bootPendingCharts = true; return; }

      const k = _makeKey();
      const t = _now();
      if (k === _lastChartsKey && (t - _lastChartsAt) < 200) return;
      _lastChartsKey = k; _lastChartsAt = t;

      if (_chartsReq) return;
      _chartsReq = true;
      window.TB_DEFER.coalesceIdle(function(){
        _chartsReq = false;
        try { if (typeof window.redrawCharts === "function") return window.redrawCharts(); }
        catch (e) { console.warn("[TB] redrawCharts failed", e); }
      }, 500);
    };

    // Called once at the end of boot to release accumulated requests (if any).
    window.tbReleaseBootRenders = window.tbReleaseBootRenders || function(){
      if (_bootPendingRender) { _bootPendingRender = false; window.tbRequestRenderAll("boot:release"); }
      if (_bootPendingCharts) { _bootPendingCharts = false; window.tbRequestRedrawCharts("boot:release"); }
    };
  })();


  // mark as early as possible
  mark("boot:script_start");
})();
