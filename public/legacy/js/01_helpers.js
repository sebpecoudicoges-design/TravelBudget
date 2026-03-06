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
   UI helpers (V6.6)
   ========================= */
function tbHelp(text) {
  // Lightweight tooltip using title attribute
  const t = escapeHTML(String(text || ""));
  return `<span class="tb-help" title="${t}" aria-label="${t}">?</span>`;
}


;/* =========================
   Wallet effective balance (V1)
   - Display wallet balance as baseline + sum of wallet transactions
   - Conservative: does not mutate DB, only affects UI display/derived totals.
   - IMPORTANT: we intentionally ignore payNow here because users expect wallet balance
     to reflect any transaction created "from a wallet".
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
      // fxConvert(amount, from, to, dateISO?) — date optional depending on implementation
      return Number(window.fxConvert(amt, fromCur, target));
    }
  } catch (_) {}

  return amt; // fallback: no conversion
}

// --- helper robuste pour convertir en timestamp ---
function _tbTs(v) {
  if (v === null || v === undefined || v === "") return null;

  // déjà un nombre (timestamp ms)
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : null;
  }

  // string pouvant être un nombre
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== "") {
    if (n > 1e11) return n; // epoch ms
  }

  const ts = Date.parse(String(v));
  return Number.isFinite(ts) ? ts : null;
}


// --- calcul du solde effectif d'une wallet ---
function tbGetWalletEffectiveBalance(walletId) {

  const w = state.wallets.find(x => x.id === walletId);
  if (!w) return 0;

  const base = Number(w.balance || 0);

  const snapRaw = w.balance_snapshot_at ?? w.balanceSnapshotAt ?? null;
  const snapTs = _tbTs(snapRaw);

  let delta = 0;

  const txs = state.transactions || [];

  for (const tx of txs) {

    if (tx.walletId !== walletId) continue;

    if (tx.payNow === false) continue;
    if (tx.isInternal === true) continue;

    const txTs = _tbTs(tx.createdAt ?? tx.created_at ?? null);

    if (snapTs && txTs && txTs < snapTs) continue;

    const amount = Number(tx.amount || 0);

    if (tx.type === "income") delta += amount;
    else if (tx.type === "expense") delta -= amount;
  }

  return base + delta;
}

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
    const pid   = p && p.id ? String(p.id) : "";
    const nm = pid ? window.tbGetPeriodName(pid) : "";
    if (nm) return nm;
    const range = (start && end) ? `${start} → ${end}` : (start || end || "");
    if (idx !== undefined && idx !== null) return `Voyage ${Number(idx)+1} : ${range}`.trim();
    return (`Voyage ${range}`.trim()) || "Voyage";
  };
})();
