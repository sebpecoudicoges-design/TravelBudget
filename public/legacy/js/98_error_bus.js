/* =========================
   Error Bus
   - Captures runtime/console errors locally
   - Syncs them to Supabase app_error_logs when available
   ========================= */
(function () {
  const MAX_MEMORY = 100;
  const MAX_STORED = 250;
  const LS_KEY = "travelbudget_error_logs_v2";
  const SYNC_LOCK_MS = 20000;
  const _buf = [];
  const _lastPushByKey = new Map();
  let _syncing = false;
  let _lastSyncAt = 0;
  let _consoleInstalled = false;

  function _now() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function _id() {
    return `elog_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function _safeString(value, max) {
    try {
      const s = typeof value === "string" ? value : JSON.stringify(value);
      return String(s == null ? "" : s).slice(0, max || 4000);
    } catch (_) {
      return String(value == null ? "" : value).slice(0, max || 4000);
    }
  }

  function _redact(value) {
    try {
      let s = typeof value === "string" ? value : JSON.stringify(value);
      s = String(s == null ? "" : s);
      s = s.replace(/(access_token|refresh_token|authorization|bearer|apikey|api_key|password|jwt)(["'\s:=]+)([^"',\s}]+)/gi, "$1$2[redacted]");
      s = s.replace(/\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\b/g, "[uuid]");
      return s;
    } catch (_) {
      return "";
    }
  }

  function _redactJson(value) {
    try {
      if (value == null) return null;
      const redacted = _redact(value);
      try { return JSON.parse(redacted); } catch (_) { return { redacted }; }
    } catch (_) {
      return null;
    }
  }

  function _toPlain(err) {
    try {
      if (!err) return { message: "Unknown error" };
      if (typeof err === "string") return { message: err };
      return {
        name: err.name,
        message: err.message || String(err),
        stack: err.stack,
        cause: err.cause ? String(err.cause) : undefined,
        code: err.code,
        details: err.details,
        hint: err.hint,
      };
    } catch (_) {
      return { message: "Unserializable error" };
    }
  }

  function _user() {
    try {
      const u = window.sbUser || window.__TB_USER || null;
      return {
        user_id: u?.id || u?.user?.id || null,
        email: null,
      };
    } catch (_) {
      return { user_id: null, email: null };
    }
  }

  function _runtime() {
    try {
      const isCapacitor = !!window.Capacitor
        || String(window.location?.protocol || "").startsWith("capacitor")
        || !!document.body?.classList?.contains("tb-capacitor-app");
      const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      const small = Number(window.innerWidth || 0) > 0 && Number(window.innerWidth || 0) <= 760;
      const mobileUa = /android|iphone|ipad|ipod|mobile/i.test(String(navigator.userAgent || ""));
      return isCapacitor
        ? "android_app"
        : (coarse || small || mobileUa ? "web_mobile" : "web_desktop");
    } catch (_) {
      return "web";
    }
  }

  function _deviceContext() {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
      return {
        viewport: {
          width: Number(window.innerWidth || 0) || null,
          height: Number(window.innerHeight || 0) || null,
          device_pixel_ratio: Number(window.devicePixelRatio || 1) || 1,
        },
        screen: {
          width: Number(window.screen?.width || 0) || null,
          height: Number(window.screen?.height || 0) || null,
        },
        connection: conn ? {
          effective_type: conn.effectiveType || null,
          downlink: conn.downlink || null,
          rtt: conn.rtt || null,
          save_data: !!conn.saveData,
        } : null,
      };
    } catch (_) {
      return {};
    }
  }

  function _context(extra) {
    const u = _user();
    let online = true;
    try { online = !(navigator && navigator.onLine === false); } catch (_) {}
    return {
      id: _id(),
      created_at: _now(),
      user_id: u.user_id,
      email: u.email,
      version: String(window.TB_VERSION || window.__TB_BUILD || "unknown"),
      build_label: String(window.TB_BUILD_LABEL || ""),
      platform: _runtime(),
      view: String(window.activeView || document.body?.dataset?.tbView || ""),
      url: String(location.href || ""),
      online,
      offline: !online || !!document.documentElement.classList.contains("tb-offline") || !!document.documentElement.classList.contains("tb-supabase-offline"),
      user_agent: String(navigator.userAgent || ""),
      device: _deviceContext(),
      ...extra,
    };
  }

  function _readStored() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function _writeStored(rows) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify((Array.isArray(rows) ? rows : []).slice(-MAX_STORED)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function _normalizeEntry(entry) {
    const e = entry || {};
    const error = e.error || e.reason || null;
    const plain = error ? _toPlain(error) : null;
    return _context({
      type: String(e.type || "error"),
      section: e.section ? String(e.section) : null,
      message: _safeString(_redact(e.message || plain?.message || e.text || "Unknown error"), 2000),
      stack: _safeString(_redact(e.stack || plain?.stack || ""), 8000),
      filename: e.filename || null,
      lineno: e.lineno || null,
      colno: e.colno || null,
      severity: String(e.severity || "error"),
      details: e.details ? _redactJson(e.details) : (plain ? _redactJson(plain) : null),
      synced: false,
    });
  }

  function push(entry) {
    try {
      const row = _normalizeEntry(entry);
      const dedupeKey = `${row.type}|${row.severity}|${row.view}|${row.message}`.slice(0, 500);
      const lastAt = Number(_lastPushByKey.get(dedupeKey) || 0);
      const nowMs = Date.now();
      if (lastAt && nowMs - lastAt < 30000) return null;
      _lastPushByKey.set(dedupeKey, nowMs);
      _buf.push(row);
      while (_buf.length > MAX_MEMORY) _buf.shift();
      const stored = _readStored();
      stored.push(row);
      _writeStored(stored);
      try {
        window.dispatchEvent(new CustomEvent("tb:error_log_changed", { detail: { count: stored.filter((x) => !x.synced).length } }));
      } catch (_) {}
      scheduleSync("push");
      return row;
    } catch (_) {
      return null;
    }
  }

  function get() {
    return _readStored().concat(_buf).slice(-MAX_STORED);
  }

  function pending() {
    return _readStored().filter((x) => x && !x.synced);
  }

  function _payload(row) {
    const currentUser = _user();
    return {
      id: row.id,
      user_id: row.user_id || currentUser.user_id || null,
      email: null,
      version: row.version || null,
      build_label: row.build_label || null,
      platform: row.platform || null,
      view: row.view || null,
      url: row.url || null,
      online: !!row.online,
      offline: !!row.offline,
      type: row.type || "error",
      severity: row.severity || "error",
      section: row.section || null,
      message: row.message || "",
      stack: row.stack || null,
      filename: row.filename || null,
      lineno: row.lineno || null,
      colno: row.colno || null,
      user_agent: row.user_agent || null,
      device: row.device || {},
      details: row.details || {},
      created_at: row.created_at || _now(),
    };
  }

  async function sync(reason) {
    if (_syncing) return { ok: false, skipped: "syncing" };
    if (Date.now() - _lastSyncAt < 1200) return { ok: false, skipped: "cooldown" };
    try {
      if (!window.sb || typeof window.sb.from !== "function") return { ok: false, skipped: "no-supabase" };
      if (!(_user().user_id)) return { ok: false, skipped: "no-user" };
      if (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) return { ok: false, skipped: "offline" };
      if (navigator && navigator.onLine === false) return { ok: false, skipped: "offline" };
    } catch (_) {}

    const rows = _readStored();
    const todo = rows.filter((x) => x && !x.synced).slice(0, 25);
    if (!todo.length) return { ok: true, synced: 0 };
    if (!String(reason || "").includes("online") && !String(reason || "").includes("diagnostic")) {
      const looksOffline = todo.some((x) => x && (x.offline === true || x.online === false));
      if (looksOffline) return { ok: false, skipped: "offline-log-batch" };
    }

    _syncing = true;
    _lastSyncAt = Date.now();
    try {
      const payload = todo.map(_payload);
      const errorLogTable = window.TB_CONST?.TABLES?.app_error_logs;
      if (!errorLogTable) throw new Error("Table app_error_logs indisponible");
      const { error } = await window.sb
        .from(errorLogTable)
        .upsert(payload, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      const synced = new Set(todo.map((x) => String(x.id)));
      const next = rows.map((x) => synced.has(String(x.id)) ? { ...x, synced: true, synced_at: _now() } : x);
      _writeStored(next);
      try { window.dispatchEvent(new CustomEvent("tb:error_log_changed", { detail: { count: next.filter((x) => !x.synced).length } })); } catch (_) {}
      return { ok: true, synced: todo.length };
    } catch (e) {
      // Do not recursively log logger failures; keep rows local until the table/RLS exists.
      return { ok: false, error: e?.message || String(e), reason };
    } finally {
      _syncing = false;
    }
  }

  function scheduleSync(reason) {
    try {
      clearTimeout(window.__TB_ERROR_LOG_SYNC_TIMER__);
      window.__TB_ERROR_LOG_SYNC_TIMER__ = setTimeout(() => { sync(reason).catch(() => {}); }, 1600);
    } catch (_) {}
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

  function exportFile() {
    try {
      const report = {
        exported_at: _now(),
        version: window.TB_VERSION || null,
        user: _user(),
        logs: get(),
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `travelbudget-error-logs-${_now().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearLocal() {
    try {
      _buf.length = 0;
      localStorage.removeItem(LS_KEY);
      try { window.dispatchEvent(new CustomEvent("tb:error_log_changed", { detail: { count: 0 } })); } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  function installConsoleCapture() {
    if (_consoleInstalled) return;
    _consoleInstalled = true;
    const originalError = console.error ? console.error.bind(console) : null;
    console.error = function () {
      try {
        const msg = Array.from(arguments).map((x) => x && x.message ? x.message : _safeString(x, 1000)).join(" ");
        if (/Offline mode:\s*Supabase request skipped/i.test(msg)) {
          if (originalError) return originalError.apply(console, arguments);
          return undefined;
        }
        push({
          type: "console.error",
          message: msg,
          details: { args: Array.from(arguments).map((x) => _toPlain(x)) },
        });
      } catch (_) {}
      if (originalError) return originalError.apply(console, arguments);
    };
  }

  function installGlobalHandlers() {
    window.addEventListener("error", (ev) => {
      push({
        type: "window.error",
        message: ev.message,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        error: ev.error,
      });
    });

    window.addEventListener("unhandledrejection", (ev) => {
      push({
        type: "unhandledrejection",
        reason: ev.reason,
      });
    });

    window.addEventListener("online", () => scheduleSync("online"));
    window.addEventListener("tb:offline_state_changed", (ev) => {
      if (ev?.detail && ev.detail.offline === false) scheduleSync("offline-state-online");
    });
    window.addEventListener("tb:auth-ready", () => scheduleSync("auth-ready"));
  }

  window.__errorBus = Object.freeze({
    push,
    get,
    pending,
    sync,
    exportFile,
    clearLocal,
    toPlain: _toPlain,
    copyToClipboard,
    installGlobalHandlers,
  });

  installGlobalHandlers();
  installConsoleCapture();
  setInterval(() => scheduleSync("interval"), SYNC_LOCK_MS);
})();
