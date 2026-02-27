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

// Expose helper globally for other modules
window.tbGetWalletEffectiveBalance = function tbGetWalletEffectiveBalance(walletId) {
  const wid = String(walletId || "");
  if (!wid || !window.state) return 0;
  const w = (state.wallets || []).find(x => String(x?.id || "") === wid);
  if (!w) return 0;

  const baseBal = Number(w.balance || 0);
  const wCur = String(w.currency || state?.period?.baseCurrency || "EUR").toUpperCase();

  let delta = 0;
  for (const tx of (state.transactions || [])) {
    if (!tx) continue;
    const txWid = String(tx.walletId ?? tx.wallet_id ?? "");
    if (txWid !== wid) continue;

    const amt = _tbTxAmountInCurrency(tx, wCur);
    if (!isFinite(amt) || amt === 0) continue;

    const t = String(tx.type || "").toLowerCase();
    if (t === "income") delta += amt;
    else if (t === "expense") delta -= amt;
  }

  return baseBal + delta;
};
