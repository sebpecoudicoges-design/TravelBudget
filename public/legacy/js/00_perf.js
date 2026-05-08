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
  const events = [];
  const counters = Object.create(null);

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

  function count(name, inc) {
    if (!enabled) return;
    counters[name] = Number(counters[name] || 0) + (Number(inc) || 1);
  }

  function event(name, data) {
    if (!enabled) return;
    events.push({ at: +now().toFixed(1), name, data: data || null });
  }

  function latestSpan(name) {
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i]?.name === name) return spans[i].ms;
    }
    return null;
  }

  function ensurePanel(label) {
    if (!enabled) return;
    try {
      let el = document.getElementById("tb-perf-panel");
      if (!el) {
        el = document.createElement("div");
        el.id = "tb-perf-panel";
        el.style.cssText = [
          "position:fixed",
          "right:12px",
          "top:12px",
          "z-index:10050",
          "width:min(360px, calc(100vw - 24px))",
          "max-height:58vh",
          "overflow:auto",
          "padding:10px 12px",
          "border-radius:8px",
          "background:rgba(15,23,42,.94)",
          "color:#f8fafc",
          "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
          "box-shadow:0 12px 34px rgba(0,0,0,.28)",
          "white-space:normal"
        ].join(";");
        document.body.appendChild(el);
      }
      const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid rgba(255,255,255,.10);padding-top:4px;margin-top:4px;"><span>${k}</span><strong>${v}</strong></div>`;
      const eventRows = events.slice(-8).map((e) => `<div style="opacity:.82;margin-top:3px;">${e.at}ms ${e.name}${e.data ? " " + JSON.stringify(e.data) : ""}</div>`).join("");
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <strong>TB PERF ${label ? "- " + label : ""}</strong>
          <button type="button" onclick="this.closest('#tb-perf-panel').remove()" style="border:0;border-radius:6px;padding:2px 6px;cursor:pointer;">x</button>
        </div>
        ${row("boot:onload", latestSpan("boot:onload") == null ? "..." : latestSpan("boot:onload") + "ms")}
        ${row("boot:refresh", latestSpan("boot:refreshFromServer") == null ? "..." : latestSpan("boot:refreshFromServer") + "ms")}
        ${row("supabase:load", latestSpan("supabase:load") == null ? "..." : latestSpan("supabase:load") + "ms")}
        ${row("supabase:bootstrap", latestSpan("supabase:bootstrap") == null ? "..." : latestSpan("supabase:bootstrap") + "ms")}
        ${row("supabase:core", latestSpan("supabase:core") == null ? "..." : latestSpan("supabase:core") + "ms")}
        ${row("fx:ensureDaily", latestSpan("fx:ensureDaily") == null ? "..." : latestSpan("fx:ensureDaily") + "ms")}
        ${row("render:all", latestSpan("render:all") == null ? "..." : latestSpan("render:all") + "ms")}
        ${row("logical queries", counters.supabaseQueries || 0)}
        <div style="margin-top:8px;color:#cbd5e1;">Derniers événements</div>
        ${eventRows || '<div style="opacity:.7;">Aucun événement</div>'}
      `;
    } catch (_) {}
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
      if (events.length) console.table(events);
      if (Object.keys(counters).length) console.table(counters);
      const total = spans.reduce((a, s) => a + (s.ms || 0), 0);
      console.log("Total (ms):", +total.toFixed(1));
      console.groupEnd();
      ensurePanel(label || "flush");
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
    now,
    count,
    event,
    panel: ensurePanel
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

    let _analysisReq = false;
    let _lastAnalysisKey = "";
    let _lastAnalysisAt = 0;
    window.tbRequestAnalysisRender = window.tbRequestAnalysisRender || function(reason){
      if (window.__TB_BOOTING) return;
      const view = (typeof activeView === 'string' && activeView)
        ? activeView
        : ((typeof window.activeView === 'string' && window.activeView) ? window.activeView : '');
      if (view !== 'analysis') return;

      const k = _makeKey();
      const t = _now();
      if (k === _lastAnalysisKey && (t - _lastAnalysisAt) < 200) return;
      _lastAnalysisKey = k; _lastAnalysisAt = t;

      if (_analysisReq) return;
      _analysisReq = true;
      const sched = window.requestAnimationFrame || function(cb){ return setTimeout(cb, 0); };
      sched(function(){
        _analysisReq = false;
        try { if (typeof window.renderBudgetAnalysis === 'function') return window.renderBudgetAnalysis(); }
        catch (e) { console.warn('[TB] renderBudgetAnalysis failed', e); }
      });
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
