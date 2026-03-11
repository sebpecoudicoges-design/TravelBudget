/* =========================
   Refresh
   ========================= */
let _refreshInFlight = false;
let _refreshPending = false;
let _refreshPromise = null;
let _tbBusyCounter = 0;

function _tbDebugRefresh() {
  try { return !!window.__tbDebugRefresh; } catch (_) { return false; }
}

function _tbRefreshLog() {
  try {
    if (!_tbDebugRefresh()) return;
    const args = Array.from(arguments);
    args.unshift('[TB]');
    console.log.apply(console, args);
  } catch (_) {}
}

window.tbAfterMutationRefresh = async function tbAfterMutationRefresh(reason, opts) {
  const options = opts || {};
  const view = (typeof activeView === 'string' && activeView) ? activeView : 'dashboard';
  const tripMode = !!(options.trip && (view === 'trip' || options.forceTrip));
  _tbRefreshLog('afterMutation:start', reason || 'mutation', options);
  await refreshFromServer({ skipRender: tripMode });
  if (tripMode && typeof window.__tripRefresh === 'function') {
    _tbRefreshLog('afterMutation:tripRefresh', reason || 'mutation');
    await window.__tripRefresh({ activeOnly: true });
  }
  _tbRefreshLog('afterMutation:done', reason || 'mutation', { view });
};

function _tbEnsureLoadingBadge() {
  let el = document.getElementById("tb-loading-badge");
  if (el) return el;
  try {
    el = document.createElement("div");
    el.id = "tb-loading-badge";
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed",
      "right:12px",
      "bottom:12px",
      "z-index:9999",
      "padding:8px 12px",
      "border-radius:999px",
      "background:rgba(17,24,39,.92)",
      "color:#fff",
      "font-size:12px",
      "font-weight:600",
      "box-shadow:0 6px 20px rgba(0,0,0,.25)",
      "opacity:0",
      "transform:translateY(6px)",
      "pointer-events:none",
      "transition:opacity .18s ease, transform .18s ease"
    ].join(";");
    el.textContent = "Chargement en cours…";
    document.body.appendChild(el);
  } catch (_) {}
  return el;
}

function _tbSetLoadingBadge(active, text) {
  try {
    const el = _tbEnsureLoadingBadge();
    if (!el) return;

    const canShow = !!active && _tbShouldShowLoadingBadge();

    el.textContent = text || "Chargement en cours…";
    el.style.opacity = canShow ? "1" : "0";
    el.style.transform = canShow ? "translateY(0)" : "translateY(6px)";
  } catch (_) {}
}

function _tbShouldShowLoadingBadge() {
  try {
    if (window.__TB_BOOTING) return false;
    if (window.__TB_BOOT_OVERLAY_ACTIVE) return false;
  } catch (_) {}
  return true;
}

function _tbApplyBusyState() {
  _tbSetLoadingBadge((_refreshInFlight || _tbBusyCounter > 0), _tbBusyCounter > 0 ? "Traitement en cours…" : "Chargement en cours…");
}

window.tbBusyStart = function tbBusyStart(text) {
  try { _tbBusyCounter += 1; } catch (_) { _tbBusyCounter = 1; }
  _tbSetLoadingBadge(true, text || "Traitement en cours…");
};

window.tbBusyEnd = function tbBusyEnd() {
  try { _tbBusyCounter = Math.max(0, Number(_tbBusyCounter || 0) - 1); } catch (_) { _tbBusyCounter = 0; }
  _tbApplyBusyState();
};

window.tbWithBusy = async function tbWithBusy(fn, text) {
  try {
    if (typeof window.tbBusyStart === "function") window.tbBusyStart(text || "Traitement en cours…");
    return await fn();
  } finally {
    try {
      if (typeof window.tbBusyEnd === "function") window.tbBusyEnd();
    } catch (_) {}
  }
};

async function _runRefreshFromServer(opts) {
  const options = opts || {};
  if (!sbUser) return;

  try {
    _tbRefreshLog("refreshFromServer:start", { view: (typeof activeView === "string" && activeView) ? activeView : "dashboard" });
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("supabase:load"); } catch (_) {}
    // FX: ensure daily rates (blocks only if no cached rates yet)
    let _fxPromise = Promise.resolve();

    if (typeof tbFxEnsureDaily === "function") {
      try {
        _fxPromise = tbFxEnsureDaily({ blockingIfEmpty: true });
      } catch (_) {}
    }

    const _dataPromise = loadFromSupabase();
    await Promise.all([_dataPromise, _fxPromise]);

    try {
      const currentView = (typeof activeView === "string" && activeView) ? activeView : "dashboard";
      if (currentView !== "dashboard" && typeof window.tbRefreshFinancialState === "function") {
        window.tbRefreshFinancialState("refreshFromServer", { cashflow: false });
      }
    } catch (_) {}

    // FX: apply cached daily rates to current period base
    if (typeof tbFxApplyToState === "function") {
      try { tbFxApplyToState({ allowPrompt: true }); } catch (_) {}
    }
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("supabase:load"); } catch (_) {}
    // FX snapshots: run in background (do not block refresh/boot)
    if (typeof ensureTxFxSnapshotsDeferred === "function") {
      ensureTxFxSnapshotsDeferred();
    } else if (typeof ensureTxFxSnapshots === "function") {
      // Fallback: fire-and-forget
      try { ensureTxFxSnapshots(); } catch (_) {}
    }
    if (typeof ensureStateIntegrity === "function") ensureStateIntegrity();
    try { if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("refresh:data_loaded", { source: "refreshFromServer" }); } catch (_) {}
    if (!options.skipRender) {
      try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("render:all"); } catch (_) {}
      if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("08_refresh.js"); else if (typeof renderAll === "function") renderAll();
      try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("render:all"); } catch (_) {}
      if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("render:done");
    }
    _tbRefreshLog("refreshFromServer:done", { view: (typeof activeView === "string" && activeView) ? activeView : "dashboard" });
  } catch (e) {
    _tbRefreshLog("refreshFromServer:error", e && (e.message || e));
    (window.log?log.error:console.error)("[refreshFromServer]", e);
    alert("Refresh impossible : " + normalizeSbError(e));
  }
}

async function refreshFromServer(opts = {}) {

  try {

    if (!state?.activeTravelId) {
      console.warn("[refreshFromServer] skipped: no active travel yet");
    } else if (typeof loadTravelContext === "function") {
      await loadTravelContext();
    } else {
      console.warn("[refreshFromServer] loadTravelContext missing");
    }

  } catch (e) {

    console.error("[refreshFromServer] failed", e);

  }

  if (!opts.skipRender) {
    renderUI();
  }

}
