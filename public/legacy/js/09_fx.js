/* =========================
   FX (ECB)
   - stocke tous les taux ECB (EUR->XXX) en localStorage
   - garde ton eur_base_rate pour la période
   ========================= */

function _fxSetEurRates(rates) {
  try { localStorage.setItem(TB_CONST.LS_KEYS.eur_rates, JSON.stringify(rates || {})); } catch (_) {}
}
function _fxGetEurRates() {
  try { return JSON.parse(localStorage.getItem(TB_CONST.LS_KEYS.eur_rates) || "{}"); } catch (_) { return {}; }
}

async function refreshFxRates() {
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("fx:refresh"); } catch (_) {}
  if (!sbUser) return alert("Non connecté.");

  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("fx:invoke"); } catch (_) {}
  const { data, error } = await sb.functions.invoke("fx-latest");
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("fx:invoke"); } catch (_) {}
  if (error) return alert(error.message);
  if (!data?.rates) return alert("Réponse taux invalide.");

  const base = state.period.baseCurrency;

  // 1) On récupère tous les taux ECB EUR->XXX
  // Merge: keep previously stored manual rates (ex: VND) when ECB doesn't provide them
const previous = _fxGetEurRates();
const allRates = { ...previous, ...data.rates };

  // 2) Collect all currencies needed by budget periods (segments) that rely on live/auto FX
  const segs = Array.isArray(state.budgetSegments) ? state.budgetSegments : [];
  const needed = new Set();
  segs.forEach((s) => {
    if (!s) return;
    const mode = String(s.fx_mode || s.fxMode || "auto");
    const cur = String(s.base_currency || s.baseCurrency || "").toUpperCase();
    if (!cur || cur === "EUR") return;
    if (mode === "fixed") return; // manual rate is stored in segment
    // auto / live_ecb: we'd like EUR->CUR to exist; if missing and no fixed fallback, we'll prompt
    needed.add(cur);
  });

  // Ensure all needed currencies have an EUR->CUR rate available,
  // otherwise ask once for a manual rate and store it in EUR_RATES.
  for (const cur of Array.from(needed)) {
    let r = Number(allRates[cur]);
    if (!r) {
      // Try fixed fallback from any segment using this currency
      const seg = segs.find(x => String(x?.baseCurrency || "").toUpperCase() === cur);
      const fixed = Number(seg?.fx_rate_eur_to_base ?? seg?.eurBaseRateFixed ?? seg?.eur_base_rate_fixed);
      if (fixed && fixed > 0) {
        allRates[cur] = fixed;
        continue;
      }
      const manual = prompt(`ECB ne fournit pas ${cur} (ou taux indisponible). Entre le taux EUR→${cur} (ex: 30800.25) :`);
      const v = Number(String(manual || "").replace(",", "."));
      if (!v || v <= 0) continue;
      allRates[cur] = v;
    }
  }



  // 2) Si la devise de période n'existe pas (ex: VND), on demande EUR->BASE en manuel
  if (base !== "EUR") {
    let eurToBase = Number(allRates[base]);
    if (!eurToBase) {
      const manual = prompt(
        `ECB ne fournit pas ${base}. Entre le taux EUR→${base} (ex: 30800.25) :`
      );
      const v = Number(String(manual || "").replace(",", "."));
      if (!v || v <= 0) return alert(`Taux invalide. Mise à jour annulée.`);
      eurToBase = v;
      allRates[base] = v; // on l'injecte dans la table EUR->XXX
    }
  } else {
    allRates["EUR"] = 1;
  }

  // 3) Stockage local (utilisé par le plugin cross-rate)
  _fxSetEurRates(allRates);

  // 4) On continue à alimenter ton moteur actuel EUR<->BASE
  const eurToBaseNow = (base === "EUR") ? 1 : Number(allRates[base]);
  state.exchangeRates["EUR-BASE"] = eurToBaseNow;
  state.exchangeRates["BASE-EUR"] = 1 / eurToBaseNow;

  // 5) Persist côté DB (comme avant)
  const { error: upErr } = await sb
    .from(TB_CONST.TABLES.periods)
    .update({ eur_base_rate: eurToBaseNow, updated_at: new Date().toISOString() })
    .eq("id", state.period.id);

  if (upErr) return alert(upErr.message);

  await refreshFromServer();
  alert(`Taux mis à jour ✅`);
}



/* =========================
   Daily FX refresh (V6.6.54)
   - Single source of truth: Edge Function "fx-latest" -> EUR->XXX
   - Auto-refresh at most once per local day
   - Silent mode: never prompts the user (uses last known manual rates as fallback)
   ========================= */

function _fxTodayKey() {
  // Local day (same basis as the rest of the app)
  try { return toLocalISODate(new Date()); } catch (_) {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }
}

function _fxGetLastDaily() {
  try { return String(localStorage.getItem(TB_CONST.LS_KEYS.fx_last_daily) || ""); } catch (_) { return ""; }
}

function _fxSetLastDaily(v) {
  try { localStorage.setItem(TB_CONST.LS_KEYS.fx_last_daily, String(v || "")); } catch (_) {}
}

async function tbFxEnsureDaily(opts) {
  const o = opts || {};
  const blockingIfEmpty = (o.blockingIfEmpty !== false);

  const today = _fxTodayKey();
  const last = _fxGetLastDaily();
  const haveAnyRates = Object.keys(_fxGetEurRates() || {}).length > 0;

  // Up-to-date already
  if (last === today && haveAnyRates) return { refreshed: false, reason: "already_today" };

  // If we already have rates, do not block UI boot.
  const shouldBlock = blockingIfEmpty && !haveAnyRates;

  const run = async () => {
    try {
      const { data, error } = await sb.functions.invoke("fx-latest");
      if (error) throw error;
      if (!data?.rates) throw new Error("Réponse taux invalide.");

      // Merge: keep previous manual rates when provider doesn't give them
      const previous = _fxGetEurRates();
      const merged = { ...previous, ...data.rates, EUR: 1 };

      _fxSetEurRates(merged);
      _fxSetLastDaily(today);

      // Apply to state immediately (no DB write)
      if (typeof tbFxApplyToState === "function") tbFxApplyToState();

      return { refreshed: true, date: data.date || null };
    } catch (e) {
      console.warn("[fx] daily refresh failed (kept cached rates):", e?.message || e);
      return { refreshed: false, error: e?.message || String(e) };
    }
  };

  if (shouldBlock) return await run();
  // fire-and-forget
  try { run(); } catch (_) {}
  return { refreshed: false, reason: "deferred" };
}
window.tbFxEnsureDaily = tbFxEnsureDaily;

function tbFxApplyToState() {
  try {
    if (!window.state || !window.state.period) return;
    const base = String(window.state.period.baseCurrency || "").toUpperCase();
    if (!base) return;

    const rates = _fxGetEurRates() || {};
    const eurToBase = (base === "EUR") ? 1 : Number(rates[base]);
    if (!eurToBase || !Number.isFinite(eurToBase) || eurToBase <= 0) return;

    window.state.exchangeRates = window.state.exchangeRates || {};
    window.state.exchangeRates["EUR-BASE"] = eurToBase;
    window.state.exchangeRates["BASE-EUR"] = 1 / eurToBase;

    // Keep period.eurBaseRate aligned in-memory (DB stays as-is unless user explicitly updates)
    window.state.period.eurBaseRate = eurToBase;
  } catch (e) {
    console.warn("[fx] applyToState failed:", e?.message || e);
  }
}
window.tbFxApplyToState = tbFxApplyToState;

/* =========================
   FX API (cross-rate via EUR_RATES)
   - Source of truth: localStorage EUR_RATES (EUR->XXX), + fallback period.eurBaseRate for baseCurrency
   - Expose: window.fxRate(from,to[,rates]), window.fxConvert(amount,from,to[,rates]), window.safeFxConvert(...)
   ========================= */

function fxGetEurRates() { return _fxGetEurRates(); }

function _fxNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function _fxEurTo(cur, rates) {
  const c = String(cur || "").toUpperCase();
  if (!c) return null;
  if (c === "EUR") return 1;

  const r = _fxNum((rates || {})[c]);
  if (r && r > 0) {
    // If localStorage rates are accidentally inverted (BASE->EUR) for the period base currency,
    // prefer the authoritative eurBaseRate (1 EUR = X BASE) when it looks like an exact reciprocal.
    const base = String(window.state?.period?.baseCurrency || "").toUpperCase();
    const eurBaseRate = _fxNum(window.state?.period?.eurBaseRate);
    if (base && c === base && eurBaseRate && eurBaseRate > 0) {
      const prod = r * eurBaseRate;
      if (Number.isFinite(prod) && Math.abs(prod - 1) < 0.02) return eurBaseRate;
    }
    // ✅ added safety: fallback to exchangeRates if eurBaseRate not ready
    const ex = _fxNum(window.state?.exchangeRates?.["EUR-BASE"]);
    if (base && c === base && ex && ex > 0) {
      const prod2 = r * ex;
      if (Number.isFinite(prod2) && Math.abs(prod2 - 1) < 0.02) return ex;
    }

    return r;
  }

  // Fallback: baseCurrency via eurBaseRate (if available) (if available)
  const base = String(window.state?.period?.baseCurrency || "").toUpperCase();
  const eurBaseRate = _fxNum(window.state?.period?.eurBaseRate);
  if (base && c === base && eurBaseRate && eurBaseRate > 0) return eurBaseRate;

  return null;
}

function fxRate(from, to, ratesOpt) {
  const f = String(from || "").toUpperCase();
  const t = String(to || "").toUpperCase();
  if (!f || !t) return null;
  if (f === t) return 1;

  const rates = ratesOpt || _fxGetEurRates();
  const eurToFrom = _fxEurTo(f, rates);
  const eurToTo   = _fxEurTo(t, rates);
  if (!eurToFrom || !eurToTo) return null;

  return eurToTo / eurToFrom;
}

function fxConvert(amount, from, to, ratesOpt) {
  const a = _fxNum(amount) ?? 0;
  const r = fxRate(from, to, ratesOpt);
  if (!r) return null;
  const out = a * r;
  return Number.isFinite(out) ? out : null;
}

// Never returns NaN. If conversion fails, returns fallback (default 0).
function safeFxConvert(amount, from, to, fallback) {
  const v = fxConvert(amount, from, to);
  if (v === null || !Number.isFinite(v)) {
    const fb = Number(fallback);
    return Number.isFinite(fb) ? fb : 0;
  }
  return v;
}

window.fxGetEurRates = fxGetEurRates;
window.fxRate = fxRate;
window.fxConvert = fxConvert;
window.safeFxConvert = safeFxConvert;


// =========================
// Currency helpers (V6.6)
// - Used by Settings UI to avoid free-text currencies
// =========================

// Return true if ECB provides a EUR-><cur> rate (i.e., we can do auto FX).
function tbFxIsAutoAvailable(cur) {
  try {
    const c = String(cur || "").toUpperCase();
    if (!c) return false;
    if (c === "EUR") return true;
    const rates = _fxGetEurRates() || {};
    return Object.prototype.hasOwnProperty.call(rates, c);
  } catch (_) {
    return false;
  }
}
window.tbFxIsAutoAvailable = tbFxIsAutoAvailable;

function tbGetAvailableCurrencies() {
  try {
    const rates = _fxGetEurRates() || {};
    const keys = Object.keys(rates || {}).map(k => String(k||"").toUpperCase()).filter(Boolean);
    const set = new Set(["EUR", ...keys]);
    // common travel currencies fallback (in case ECB not fetched yet)
    ["USD","GBP","CHF","THB","AUD","CAD","NZD","JPY","SEK","NOK","DKK","BRL","MXN","MAD","XOF"].forEach(c => set.add(c));
    return Array.from(set).sort();
  } catch (_) {
    return ["EUR","USD","GBP","CHF","THB"].sort();
  }
}
