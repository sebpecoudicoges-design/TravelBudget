/* =========================
   Refresh
   ========================= */
let _refreshInFlight = false;
let _refreshPending = false;
let _refreshPromise = null;
let _tbBusyCounter = 0;
let _tbLastRefreshCompletedAt = 0;
let _tbAutoRefreshLastAttemptAt = 0;

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

window.tbEnsureGovernanceData = async function tbEnsureGovernanceData(reason) {
  try {
    if (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) return;
    const tid = String(window.state?.activeTravelId || "");
    if (tid && String(window.__tbGovernanceLoadedForTravel || "") === tid) return;
    await refreshFromServer({ includeGovernance: true, includeDeferredData: true });
  } catch (e) {
    console.warn("[TB] governance refresh failed:", e?.message || e);
  }
};

window.tbEnsureDeferredData = async function tbEnsureDeferredData(reason) {
  try {
    if (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) return;
    const tid = String(window.state?.activeTravelId || "");
    if (tid && String(window.__tbDeferredDataLoadedForTravel || "") === tid) return;
    await refreshFromServer({ includeDeferredData: true, includeGovernance: reason === "analysis" || reason === "settings" });
  } catch (e) {
    console.warn("[TB] deferred data refresh failed:", e?.message || e);
  }
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
    const useOffline = (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode("refreshFromServer")
      : (navigator && navigator.onLine === false);
    if (useOffline) {
      if (typeof window.tbRestoreOfflineSnapshot === "function" && window.tbRestoreOfflineSnapshot("refreshFromServer:offline")) {
        try { if (!options.skipRender) { if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("offline-snapshot"); else if (typeof renderAll === "function") renderAll(); } } catch (_) {}
        try { if (typeof toastInfo === "function") toastInfo(window.tbOfflineMessage ? window.tbOfflineMessage() : "Mode hors ligne."); } catch (_) {}
        return;
      }
      throw new Error("Mode hors ligne : aucune sauvegarde locale disponible pour cet utilisateur.");
    }

    _tbRefreshLog("refreshFromServer:start", { view: (typeof activeView === "string" && activeView) ? activeView : "dashboard" });
    try { if (window.TB_PERF?.enabled) TB_PERF.event("refresh:start", options); } catch (_) {}
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("supabase:load"); } catch (_) {}
    // FX: ensure daily rates (blocks only if no cached rates yet)
    let _fxPromise = Promise.resolve();

    if (typeof tbFxEnsureDaily === "function") {
      try {
        try { if (window.TB_PERF?.enabled) TB_PERF.mark("fx:ensureDaily"); } catch (_) {}
        _fxPromise = tbFxEnsureDaily({ blockingIfEmpty: true }).finally(() => {
          try { if (window.TB_PERF?.enabled) TB_PERF.end("fx:ensureDaily"); } catch (_) {}
        });
      } catch (_) {}
    }

    const _dataPromise = loadFromSupabase(options);
    await Promise.all([_dataPromise, _fxPromise]);

    // FX: apply cached daily rates to current period base
    if (typeof tbFxApplyToState === "function") {
      try { tbFxApplyToState({ allowPrompt: true }); } catch (_) {}
    }
    try {
      if (!options.skipFinancialRender && typeof window.tbRefreshFinancialState === "function") {
        window.tbRefreshFinancialState("refreshFromServer", { cashflow: false });
      }
    } catch (_) {}
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("supabase:load"); } catch (_) {}
    // FX snapshots: run in background (do not block refresh/boot)
    if (typeof ensureTxFxSnapshotsDeferred === "function") {
      ensureTxFxSnapshotsDeferred();
    } else if (typeof ensureTxFxSnapshots === "function") {
      // Fallback: fire-and-forget
      try { ensureTxFxSnapshots(); } catch (_) {}
    }
    if (typeof ensureStateIntegrity === "function") ensureStateIntegrity();
    try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot("refreshFromServer"); } catch (_) {}
    try { if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("refresh:data_loaded", { source: "refreshFromServer" }); } catch (_) {}
    _tbLastRefreshCompletedAt = Date.now();
    try { window.__tbLastRefreshCompletedAt = _tbLastRefreshCompletedAt; } catch (_) {}
    if (!options.skipRender) {
      try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("render:all"); } catch (_) {}
      if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("08_refresh.js"); else if (typeof renderAll === "function") renderAll();
      try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("render:all"); } catch (_) {}
      if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("render:done");
    }
    try {
      if (window.TB_PERF?.enabled) {
        TB_PERF.event("refresh:done", { skipRender: !!options.skipRender });
        TB_PERF.panel("refresh");
        TB_PERF.flush("refresh done");
      }
    } catch (_) {}
    _tbRefreshLog("refreshFromServer:done", { view: (typeof activeView === "string" && activeView) ? activeView : "dashboard" });
  } catch (e) {
    _tbRefreshLog("refreshFromServer:error", e && (e.message || e));
    (window.log?log.error:console.error)("[refreshFromServer]", e);
    try { if (typeof window.tbMarkNetworkUnavailable === "function" && /failed to fetch|network|name_not_resolved/i.test(String(e?.message || e))) window.tbMarkNetworkUnavailable("refresh-error"); } catch (_) {}
    if (navigator && navigator.onLine === false && typeof window.tbRestoreOfflineSnapshot === "function" && window.tbRestoreOfflineSnapshot("refreshFromServer:error")) {
      try { if (!options.skipRender) { if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("offline-snapshot"); else if (typeof renderAll === "function") renderAll(); } } catch (_) {}
      try { if (typeof toastInfo === "function") toastInfo(window.tbOfflineMessage ? window.tbOfflineMessage() : "Mode hors ligne."); } catch (_) {}
      return;
    }
    if (!options.auto && !options.silent) alert("Refresh impossible : " + normalizeSbError(e));
  }
}

async function tbRefreshIfStale(reason, opts = {}) {
  try {
    if (!sbUser) return false;
    if (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) return false;
    if (typeof document !== "undefined" && document.hidden && !opts.force) return false;
    const now = Date.now();
    const minIntervalMs = Number(opts.minIntervalMs || 120000);
    const attemptCooldownMs = Number(opts.attemptCooldownMs || 30000);
    const lastDone = Number(window.__tbLastRefreshCompletedAt || _tbLastRefreshCompletedAt || 0);
    if (!opts.force && now - _tbAutoRefreshLastAttemptAt < attemptCooldownMs) return false;
    if (!opts.force && lastDone && now - lastDone < minIntervalMs) return false;
    _tbAutoRefreshLastAttemptAt = now;
    await refreshFromServer({ reason: reason || "auto", auto: true });
    try { if (typeof window.tbSyncPreferenceDrivenNotifications === "function") window.tbSyncPreferenceDrivenNotifications(); } catch (_) {}
    try { if (typeof window.tbRefreshInboxBadge === "function") window.tbRefreshInboxBadge(); } catch (_) {}
    return true;
  } catch (e) {
    console.warn("[TB] auto refresh skipped:", e?.message || e);
    return false;
  }
}

window.tbRefreshIfStale = tbRefreshIfStale;

function tbInstallAutoRefreshHooks() {
  if (window.__tbAutoRefreshHooksInstalled) return;
  window.__tbAutoRefreshHooksInstalled = true;
  const run = (reason) => { try { tbRefreshIfStale(reason); } catch (_) {} };
  try {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) run("visibility");
    });
  } catch (_) {}
  try { window.addEventListener("focus", () => run("focus")); } catch (_) {}
  try {
    const App = window.Capacitor?.Plugins?.App || window.Capacitor?.App;
    if (App?.addListener) {
      App.addListener("resume", () => run("app-resume"));
      App.addListener("appStateChange", (state) => {
        if (state?.isActive) run("app-active");
      });
    }
  } catch (_) {}
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tbInstallAutoRefreshHooks);
  else tbInstallAutoRefreshHooks();
}

async function refreshFromServer(opts = {}) {
  if (opts && opts.force === true && typeof window.tbResetClientSessionState === 'function') {
    try { window.tbResetClientSessionState('refresh-force'); } catch (_) {}
  }

  if (_refreshInFlight) {
    _refreshPending = true;
    _tbRefreshLog("refreshFromServer:queued");
    return _refreshPromise || Promise.resolve();
  }

  _refreshInFlight = true;
  _refreshPending = false;
  _tbApplyBusyState();

  _refreshPromise = (async () => {
    try {
      await _runRefreshFromServer(opts);
    } finally {
      _refreshInFlight = false;
      _tbApplyBusyState();
      const rerun = _refreshPending;
      _refreshPending = false;
      _refreshPromise = null;
      if (rerun) {
        _tbRefreshLog("refreshFromServer:rerun");
        return refreshFromServer(opts);
      }
    }
  })();

  return _refreshPromise;
}
