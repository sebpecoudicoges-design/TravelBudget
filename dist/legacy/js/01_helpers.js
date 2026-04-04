/* =========================
   Helpers
   ========================= */
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
function toLocalISODate(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISODateOrNull(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function clampMidnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function forEachDateInclusive(start, end, cb) {
  for (let d = clampMidnight(start); d <= clampMidnight(end); d.setDate(d.getDate() + 1)) cb(new Date(d));
}
function dayCountInclusive(start, end) {
  const s = clampMidnight(start), e = clampMidnight(end);
  return Math.max(1, Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1);
}
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function fmtMoney(v, cur) {
  const n = Number(v);
  if (!isFinite(n)) return `0 ${cur}`;
  return `${n.toFixed(2)} ${cur}`;
}
function hexToRgba(hex, alpha) {
  const h = String(hex).replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map(ch => ch + ch).join("") : h;
  const n = parseInt(full, 16);
  if (!isFinite(n)) return `rgba(0,0,0,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
function normalizeSbError(err) {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;
  return err.message || JSON.stringify(err);
}
function assertAuth() {
  if (!sbUser) throw new Error("Session expirée. Reconnecte-toi.");
}
async function safeCall(label, fn) {
  try {
    assertAuth();
    return await fn();
  } catch (e) {
    console.error(`[${label}]`, e);
    alert(`${label} : ${normalizeSbError(e)}`);
    throw e;
  }
}

// Basic HTML escaping for safe UI rendering.
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}



/* =========================
   Logging + Money utils (V4.1)
   - structured console logs
   - safe rounding helpers for monetary values
   ========================= */
(function(){
  const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
  const KEY = "TB_LOG_LEVEL";
  function getLevel(){
    const v = (localStorage.getItem(KEY) || "info").toLowerCase();
    return LEVELS[v] || LEVELS.info;
  }
  function setLevel(v){
    try{ localStorage.setItem(KEY, String(v||"info").toLowerCase()); }catch(_){ }
  }
  function now(){ return new Date().toISOString(); }
  function baseLog(lvl, args){
    if (getLevel() > LEVELS[lvl]) return;
    const prefix = `[${now()}][${lvl.toUpperCase()}]`;
    const fn = (console && console[lvl]) ? console[lvl].bind(console) : console.log.bind(console);
    fn(prefix, ...args);
  }
  window.log = {
    getLevel: () => (localStorage.getItem(KEY) || "info"),
    setLevel,
    debug: (...a)=>baseLog('debug',a),
    info: (...a)=>baseLog('info',a),
    warn: (...a)=>baseLog('warn',a),
    error: (...a)=>baseLog('error',a),
  };
})();

function _safeNumber(v, fallback=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function moneyRound(n, decimals=2){
  const x = _safeNumber(n, 0);
  const p = Math.pow(10, decimals);
  return Math.round((x + Number.EPSILON) * p) / p;
}
function moneyAdd(a,b,decimals=2){
  return moneyRound(_safeNumber(a,0)+_safeNumber(b,0), decimals);
}

// Upgrade fmtMoney to be stable and locale-aware when possible
(function(){
  const _orig = typeof window.fmtMoney === 'function' ? window.fmtMoney : null;
  window.fmtMoney = function(v, cur){
    const n = _safeNumber(v, 0);
    const c = (cur || '').trim() || '';
    try{
      // Use browser locale; avoids 1.999999 -> 2.00 display glitches
      const f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${f.format(moneyRound(n,2))}${c ? ' ' + c : ''}`;
    }catch(_){
      return `${moneyRound(n,2).toFixed(2)}${c ? ' ' + c : ''}`;
    }
  };
})();




/* =========================
   Transaction dual-date helpers (V9.4.1.8)
   - cash / wallet / FX timing => cash date
   - budget / dashboard / analysis timing => budget dates
   ========================= */
function tbNormalizeDateISO(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? toLocalISODate(d) : null;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? toLocalISODate(value) : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? toLocalISODate(d) : null;
  }
  return null;
}
function tbTxCashDate(tx) {
  return tbNormalizeDateISO(
    tx?.dateStart ||
    tx?.date_start ||
    tx?.occurrenceDate ||
    tx?.occurrence_date ||
    tx?.date ||
    tx?.created_at ||
    tx?.createdAt ||
    null
  );
}
function tbTxBudgetStart(tx) {
  return tbNormalizeDateISO(
    tx?.budgetDateStart ||
    tx?.budget_date_start ||
    tx?.dateStart ||
    tx?.date_start ||
    tx?.occurrenceDate ||
    tx?.occurrence_date ||
    tx?.date ||
    tx?.created_at ||
    tx?.createdAt ||
    null
  );
}
function tbTxBudgetEnd(tx) {
  return tbNormalizeDateISO(
    tx?.budgetDateEnd ||
    tx?.budget_date_end ||
    tx?.dateEnd ||
    tx?.date_end ||
    tbTxBudgetStart(tx) ||
    null
  );
}
function tbTxBudgetRange(tx) {
  const start = tbTxBudgetStart(tx);
  const end = tbTxBudgetEnd(tx) || start;
  return { start, end };
}

window.tbNormalizeDateISO = tbNormalizeDateISO;
window.tbTxCashDate = tbTxCashDate;
window.tbTxBudgetStart = tbTxBudgetStart;
window.tbTxBudgetEnd = tbTxBudgetEnd;
window.tbTxBudgetRange = tbTxBudgetRange;

/* =========================
   UI helpers (V6.6)
   ========================= */
function tbHelp(text) {
  // Lightweight tooltip using title attribute
  const t = escapeHTML(String(text || ""));
  return `<span class="tb-help" title="${t}" aria-label="${t}">?</span>`;
}


;/* =========================
   Wallet effective balance (V2)
   - Prefer SQL view public.v_wallet_balances when available.
   - Fallback to legacy JS computation if the view is absent/not loaded.
   - Wallet reflects real cash movements:
     * include paid movements
     * exclude internal/shadow rows
     * apply only rows after balance_snapshot_at
   ========================= */

function _tbTxAmountInCurrency(tx, toCur) {
  const amt = Number(tx?.amount || 0);
  const fromCur = String(tx?.currency || toCur || "").toUpperCase();
  const target = String(toCur || fromCur || "").toUpperCase();
  if (!isFinite(amt) || !target) return 0;
  if (fromCur === target) return amt;

  // Prefer FX engine if available
  try {
    if (typeof window.fxConvert === "function") {
      return Number(window.fxConvert(amt, fromCur, target));
    }
  } catch (_) {}

  return amt; // fallback: no conversion
}

function _tbToTimestamp(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return s.length === 10 ? n * 1000 : n;
  }
  const ts = Date.parse(s);
  return Number.isFinite(ts) ? ts : null;
}

function _tbLegacyWalletEffectiveBalance(walletId) {
  const wid = String(walletId || "");
  if (!wid || !window.state) return 0;
  const w = (state.wallets || []).find(x => String(x?.id || "") === wid);
  if (!w) return 0;

  const baseBal = Number(w.balance || 0);
  const wCur = String(w.currency || state?.period?.baseCurrency || "EUR").toUpperCase();
  const snapRaw = w.balance_snapshot_at ?? w.balanceSnapshotAt ?? null;
  const snapTs = _tbToTimestamp(snapRaw);

  let delta = 0;
  for (const tx of (state.transactions || [])) {
    if (!tx) continue;
    const txWid = String(tx.walletId ?? tx.wallet_id ?? "");
    if (txWid !== wid) continue;

    if (snapTs != null) {
      const txCreated = tx.createdAt ?? tx.created_at ?? null;
      const txTs = _tbToTimestamp(txCreated);
      if (txTs == null || txTs < snapTs) continue;
    }

    const p = (tx.payNow ?? tx.pay_now);
    const paid = (p === undefined) ? true : !!p;
    if (!paid) continue;

    const isInternal = !!(tx.isInternal ?? tx.is_internal);
    if (isInternal) continue;

    const amt = _tbTxAmountInCurrency(tx, wCur);
    if (!isFinite(amt) || amt === 0) continue;

    const t = String(tx.type || "").toLowerCase();
    if (t === "income") delta += amt;
    else if (t === "expense") delta -= amt;
  }

  return baseBal + delta;
}

window.tbGetWalletBalanceRow = function tbGetWalletBalanceRow(walletId) {
  const wid = String(walletId || "");
  if (!wid || !window.state) return null;
  const map = state.walletBalanceMap || {};
  const row = map[wid];
  return row && Number.isFinite(Number(row.effectiveBalance)) ? row : null;
};

window.tbGetWalletEffectiveBalance = function tbGetWalletEffectiveBalance(walletId) {
  const row = (typeof window.tbGetWalletBalanceRow === "function")
    ? window.tbGetWalletBalanceRow(walletId)
    : null;
  if (row) return Number(row.effectiveBalance || 0);
  return _tbLegacyWalletEffectiveBalance(walletId);
};

/* =========================
   Period names (V6.6.90)
   - DB table "periods" has no name column (per SQL schema)
   - Store user-defined names locally (localStorage) keyed by period_id
   - Used for Settings + Dashboard labels
   ========================= */
(function () {
  function _lsKey() {
    try { return (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.period_names) ? TB_CONST.LS_KEYS.period_names : "travelbudget_period_names_v1"; } catch (_) {}
    return "travelbudget_period_names_v1";
  }

  function _load() {
    try {
      const raw = localStorage.getItem(_lsKey());
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : {};
    } catch (_) { return {}; }
  }

  function _save(map) {
    try { localStorage.setItem(_lsKey(), JSON.stringify(map || {})); } catch (_) {}
  }

  window.tbGetPeriodName = function (periodId) {
    const id = String(periodId || "");
    if (!id) return "";
    const map = _load();
    const v = map[id];
    return (v && String(v).trim()) ? String(v).trim() : "";
  };

  window.tbSetPeriodName = function (periodId, name) {
    const id = String(periodId || "");
    if (!id) return false;
    const nm = String(name || "").trim();
    const map = _load();
    if (!nm) delete map[id];
    else map[id] = nm;
    _save(map);
    try { if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("periods:changed", { period_id: id }); } catch (_) {}
    return true;
  };

  window.tbFormatPeriodLabel = function (p, idx) {
    const start = (p && (p.start || p.start_date)) ? String(p.start || p.start_date).slice(0,10) : "";
    const end   = (p && (p.end || p.end_date)) ? String(p.end || p.end_date).slice(0,10) : "";
    const travelId = String(p?.travelId || p?.travel_id || "");
    const travel = (state?.travels || []).find(t => String(t.id) === travelId);
    const nm = String(travel?.name || "").trim();
    if (nm) return nm;
    const range = (start && end) ? `${start} → ${end}` : (start || end || "");
    if (idx !== undefined && idx !== null) return `Voyage ${Number(idx)+1} : ${range}`.trim();
    return (`Voyage ${range}`.trim()) || "Voyage";
  };
})();
