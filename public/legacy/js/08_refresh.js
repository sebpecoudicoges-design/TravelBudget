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
    const hasTx = !tid || (Array.isArray(window.state?.transactions) && window.state.transactions.some((tx) => String(tx?.travel_id || tx?.travelId || "") === tid));
    if (tid && String(window.__tbDeferredDataLoadedForTravel || "") === tid && hasTx) return;
    await refreshFromServer({ includeDeferredData: true, includeGovernance: reason === "analysis" || reason === "settings" });
    if (reason !== "analysis") await window.tbEnsureActiveTravelTransactions?.(reason || "deferred");
  } catch (e) {
    console.warn("[TB] deferred data refresh failed:", e?.message || e);
  }
};

window.tbEnsureActiveTravelTransactions = async function tbEnsureActiveTravelTransactions(reason, travelId) {
  try {
    const tid = String(travelId || window.state?.activeTravelId || window.state?.period?.travel_id || window.state?.period?.travelId || "").trim();
    const isAnalysis = String(reason || "").startsWith("analysis");
    const txCount = (window.state?.transactions || []).filter((tx) => String(tx?.travel_id || tx?.travelId || "") === tid).length;
    if (!tid || (txCount && !isAnalysis) || (isAnalysis && String(window.__tbAnalysisTransactionsHydratedForTravel || "") === tid && txCount > 0)) return false;
    window.__tbActiveTravelTransactionsInFlight = window.__tbActiveTravelTransactionsInFlight || {};
    if (window.__tbActiveTravelTransactionsInFlight[tid]) return await window.__tbActiveTravelTransactionsInFlight[tid];
    window.__tbActiveTravelTransactionsInFlight[tid] = (async () => {
    const sbc = window.sb || window.__TB_SB__;
    const user = window.sbUser || window.__tbUser || (await sbc?.auth?.getUser?.())?.data?.user;
    if (!sbc || !user?.id) return false;
    const sel = "id,travel_id,period_id,wallet_id,type,amount,currency,category,subcategory,label,trip_expense_id,trip_share_link_id,internal_transfer_id,is_internal,date_start,date_end,budget_date_start,budget_date_end,pay_now,paid_at,out_of_budget,night_covered,affects_budget,created_at,recurring_rule_id,occurrence_date,generated_by_rule,recurring_instance_status";
    let from = 0, rows = [];
    while (true) {
      const { data, error } = await sbc.from(TB_CONST.TABLES.transactions).select(sel).eq("user_id", user.id).eq("travel_id", tid).order("created_at", { ascending: true }).range(from, from + 999);
      if (error) throw error;
      rows = rows.concat(data || []);
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    if (!rows.length) return false;
    const mapped = rows.map((x) => ({
      id: x.id, travelId: x.travel_id || null, travel_id: x.travel_id || null, periodId: x.period_id || null, period_id: x.period_id || null, walletId: x.wallet_id, wallet_id: x.wallet_id,
      type: x.type, amount: Number(x.amount), currency: x.currency, category: x.category, subcategory: x.subcategory || null, label: x.label || "",
      tripExpenseId: x.trip_expense_id || null, trip_expense_id: x.trip_expense_id || null, tripShareLinkId: x.trip_share_link_id || null, trip_share_link_id: x.trip_share_link_id || null,
      internalTransferId: x.internal_transfer_id || null, internal_transfer_id: x.internal_transfer_id || null, isInternal: !!x.is_internal, is_internal: !!x.is_internal,
      affectsBudget: x.affects_budget !== false, affects_budget: x.affects_budget !== false, dateStart: x.date_start, date_start: x.date_start, dateEnd: x.date_end, date_end: x.date_end,
      budgetDateStart: x.budget_date_start || x.date_start, budget_date_start: x.budget_date_start || x.date_start, budgetDateEnd: x.budget_date_end || x.budget_date_start || x.date_end || x.date_start, budget_date_end: x.budget_date_end || x.budget_date_start || x.date_end || x.date_start,
      payNow: x.pay_now !== false, pay_now: x.pay_now !== false, paidAt: x.paid_at || null, paid_at: x.paid_at || null, outOfBudget: !!x.out_of_budget, out_of_budget: !!x.out_of_budget, nightCovered: !!x.night_covered, night_covered: !!x.night_covered,
      recurringRuleId: x.recurring_rule_id || null, recurring_rule_id: x.recurring_rule_id || null, occurrenceDate: x.occurrence_date || null, occurrence_date: x.occurrence_date || null, generatedByRule: !!x.generated_by_rule, generated_by_rule: !!x.generated_by_rule, recurringInstanceStatus: x.recurring_instance_status || null, recurring_instance_status: x.recurring_instance_status || null,
      createdAt: new Date(x.created_at).getTime(), created_at: x.created_at, date: x.date_start ? new Date(String(x.date_start) + "T00:00:00").getTime() : new Date(x.created_at).getTime()
    }));
    window.state.transactions = (window.state.transactions || []).filter((tx) => String(tx?.travel_id || tx?.travelId || "") !== tid).concat(mapped);
    window.__tbDeferredDataLoadedForTravel = tid;
    if (isAnalysis) window.__tbAnalysisTransactionsHydratedForTravel = tid;
    console.info("[TB] active travel transactions loaded", { reason, travelId: tid, before: txCount, count: mapped.length });
    return true;
    })();
    return await window.__tbActiveTravelTransactionsInFlight[tid];
  } catch (e) {
    console.warn("[TB] active travel transactions fallback failed:", e?.message || e);
    return false;
  } finally {
    try {
      const tid = String(travelId || window.state?.activeTravelId || window.state?.period?.travel_id || window.state?.period?.travelId || "").trim();
      if (tid && window.__tbActiveTravelTransactionsInFlight) delete window.__tbActiveTravelTransactionsInFlight[tid];
    } catch (_) {}
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

function _tbEmitRefreshDataLoaded(detail) {
  const payload = detail || { source: "refreshFromServer" };
  let emitted = false;
  try {
    if (window.tbBus && typeof tbBus.emit === "function") {
      tbBus.emit("refresh:data_loaded", payload);
      emitted = true;
    }
  } catch (_) {}
  if (!emitted) {
    try {
      window.__TB_DATA_REV = (Number(window.__TB_DATA_REV || 0) + 1);
      window.__TB_DATA_UPDATED_AT = Date.now();
    } catch (_) {}
    try { document.dispatchEvent(new CustomEvent("tb:refresh:data_loaded", { detail: payload })); } catch (_) {}
    try { document.dispatchEvent(new Event("data:updated")); } catch (_) {}
  }
  try { document.dispatchEvent(new CustomEvent("tb:financial:data_loaded", { detail: payload })); } catch (_) {}
}

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
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("supabase:load"); } catch (_) {}
    // FX snapshots: run in background (do not block refresh/boot)
    if (typeof ensureTxFxSnapshotsDeferred === "function") {
      ensureTxFxSnapshotsDeferred();
    } else if (typeof ensureTxFxSnapshots === "function") {
      // Fallback: fire-and-forget
      try { ensureTxFxSnapshots(); } catch (_) {}
    }
    if (typeof ensureStateIntegrity === "function") ensureStateIntegrity();
    try { if (typeof window.tbClearBudgetCaches === "function") window.tbClearBudgetCaches(); } catch (_) {}
    try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot("refreshFromServer"); } catch (_) {}
    _tbEmitRefreshDataLoaded({ source: "refreshFromServer", reason: options.reason || null, includeDeferredData: !!options.includeDeferredData });
    try {
      if (!options.skipFinancialRender && typeof window.tbRefreshFinancialState === "function") {
        window.tbRefreshFinancialState("refreshFromServer", { cashflow: false });
      }
    } catch (_) {}
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
