/* =========================
   Refresh
   ========================= */
let _refreshInFlight = false;
let _refreshPending = false;
let _refreshPromise = null;
let _tbBusyCounter = 0;

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
    el.textContent = text || "Chargement en cours…";
    el.style.opacity = active ? "1" : "0";
    el.style.transform = active ? "translateY(0)" : "translateY(6px)";
  } catch (_) {}
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

async function _runRefreshFromServer() {
  if (!sbUser) return;

  try {
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("supabase:load"); } catch (_) {}
    // FX: ensure daily rates (blocks only if no cached rates yet)
    if (typeof tbFxEnsureDaily === "function") {
      try { await tbFxEnsureDaily({ blockingIfEmpty: true }); } catch (_) {}
    }

    await loadFromSupabase();

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
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("render:all"); } catch (_) {}
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("08_refresh.js"); else if (typeof renderAll === "function") renderAll();
try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("render:all"); } catch (_) {}
    if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("render:done");
  } catch (e) {
    (window.log?log.error:console.error)("[refreshFromServer]", e);
    alert("Refresh impossible : " + normalizeSbError(e));
  }
}

async function refreshFromServer() {
  if (!sbUser) return;
  if (_refreshInFlight) {
    _refreshPending = true;
    return _refreshPromise;
  }

  _refreshInFlight = true;
  _refreshPending = false;
  _tbApplyBusyState();

  _refreshPromise = (async () => {
    try {
      do {
        _refreshPending = false;
        await _runRefreshFromServer();
      } while (_refreshPending);
    } finally {
      _refreshInFlight = false;
      _tbApplyBusyState();
    }
  })();

  return _refreshPromise;
}
