/* =========================
   FX (Auto)
   - Source unique: Edge Function `fx-latest`
   - Stocke les taux EUR->XXX en localStorage
   - Pas de prompt: si une devise manque, on garde le cache existant / les taux fixes des segments
   ========================= */

function _fxSetEurRates(rates) {
  try { localStorage.setItem(TB_CONST.LS_KEYS.eur_rates, JSON.stringify(rates || {})); } catch (_) {}
}
function _fxGetEurRates() {
  try { return JSON.parse(localStorage.getItem(TB_CONST.LS_KEYS.eur_rates) || "{}"); } catch (_) { return {}; }
}

// Manual EUR->XXX rates (fallback for currencies not provided by Auto FX provider)
function _fxGetManualRates() {
  try { return JSON.parse(localStorage.getItem(TB_CONST.LS_KEYS.fx_manual_rates) || "{}"); } catch (_) { return {}; }
}
function _fxSetManualRates(map) {
  try { localStorage.setItem(TB_CONST.LS_KEYS.fx_manual_rates, JSON.stringify(map || {})); } catch (_) {}
}
function tbFxSetManualRate(cur, rate) {
  const c = String(cur || "").trim().toUpperCase();
  const r = Number(rate);
  if (!c || !/^[A-Z]{3}$/.test(c)) throw new Error("Code devise invalide (ISO3 attendu)");
  if (!Number.isFinite(r) || r <= 0) throw new Error("Taux invalide (doit être > 0)");
  const map = _fxGetManualRates();
  map[c] = r;
  _fxSetManualRates(map);
  _fxManualMarkToday(c);
  return map;
}
function tbFxDeleteManualRate(cur) {
  const c = String(cur || "").trim().toUpperCase();
  const map = _fxGetManualRates();
  delete map[c];
  _fxSetManualRates(map);
  return map;
}

function _fxGetManualAsof() {
  try {
    const raw = localStorage.getItem(TB_CONST.LS_KEYS.fx_manual_asof);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj;
    }
  } catch (_) {}
  return {};
}

function _fxSetManualAsof(map) {
  try { localStorage.setItem(TB_CONST.LS_KEYS.fx_manual_asof, JSON.stringify(map || {})); } catch (_) {}
}

function _fxManualMarkToday(cur) {
  const c = String(cur || "").trim().toUpperCase();
  if (!c) return;
  const m = _fxGetManualAsof();
  m[c] = new Date().toISOString().slice(0,10);
  _fxSetManualAsof(m);
}

function tbFxManualAsof(cur) {
  const c = String(cur || "").trim().toUpperCase();
  const m = _fxGetManualAsof();
  return m[c] || null;
}

function tbFxPromptManualRate(cur, reason) {
  const c = String(cur || "").trim().toUpperCase();
  if (!c || c === "EUR") return null;
  const why = reason ? `\n(${reason})` : "";
  const existing = (_fxGetManualRates() || {})[c];
  const hint = existing ? ` (actuel: ${existing})` : "";
  const raw = prompt(`Taux requis : EUR → ${c}${hint}${why}\n\nEntre le taux (ex: 17000) :`);
  if (raw === null) return null; // user cancelled
  const r = Number(String(raw).replace(",", "."));
  tbFxSetManualRate(c, r);
  _fxManualMarkToday(c);
  return r;
}

function _fxPromptUpdateManualIfNeeded() {
  try {
    const manual = _fxGetManualRates() || {};
    const asof = _fxGetManualAsof() || {};
    const today = new Date().toISOString().slice(0,10);
    const stale = Object.keys(manual).filter(c => c && c !== "EUR" && asof[c] !== today);
    if (!stale.length) return;

    const dayKey = TB_CONST?.LS_KEYS?.fx_manual_prompted_day;
    let last = null;
    try { last = dayKey ? localStorage.getItem(dayKey) : null; } catch (_) {}
    if (last === today) return;

    // Ask once per day max
    const ok = confirm(`Taux manuels: ${stale.join(", ")}\n\nMettre à jour les taux manuels aujourd'hui ?`);
    try { if (dayKey) localStorage.setItem(dayKey, today); } catch (_) {}
    if (!ok) return;

    for (const c of stale) {
      const r = tbFxPromptManualRate(c, "Mise à jour quotidienne");
      if (!r) break;
    }
  } catch (_) {}
}


function tbFxGetManualRates() { return _fxGetManualRates(); }

// Merge auto rates + manual rates (manual only fills missing currencies)
function fxGetEurRatesMerged() {
  const autoRates = _fxGetEurRates();
  const manual = _fxGetManualRates();
  // manual first, auto overrides (so auto stays source of truth when available)
  return Object.assign({}, manual || {}, autoRates || {});
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

  // 1) Merge provider rates with previous cache (non-destructive)
  const previous = _fxGetEurRates();
  const allRates = { ...previous, ...data.rates, EUR: 1 };

  // 2) Non-destructive fallback: inject fixed segment rates if missing (no prompts)
  const segs = Array.isArray(state.budgetSegments) ? state.budgetSegments : [];
  segs.forEach((s) => {
    const cur = String(s?.base_currency || s?.baseCurrency || "").toUpperCase();
    if (!cur || cur === "EUR") return;
    const fixed = Number(s?.fx_rate_eur_to_base ?? s?.eurBaseRateFixed ?? s?.eur_base_rate_fixed);
    if (fixed && fixed > 0 && !Number(allRates[cur])) allRates[cur] = fixed;
  });

  // 3) If some required currencies are missing, offer to capture manual fallbacks now.
  try {
    const required = new Set();
    if (base) required.add(String(base).toUpperCase());
    (Array.isArray(state.wallets) ? state.wallets : []).forEach(w => {
      const c = String(w?.currency || "").toUpperCase();
      if (c) required.add(c);
    });
    (Array.isArray(state.budgetSegments) ? state.budgetSegments : []).forEach(s => {
      const c = String(s?.base_currency || s?.baseCurrency || "").toUpperCase();
      if (c) required.add(c);
    });

    const manual = _fxGetManualRates();
    const effective = Object.assign({}, manual || {}, allRates || {});
    const missing = Array.from(required).filter(c => c && c !== "EUR" && !(Number(effective?.[c]) > 0));
    if (missing.length) {
      const ok = confirm(
        `Certaines devises n'ont pas de taux auto aujourd'hui : ${missing.join(", ")}.\n\n` +
        `Souhaites-tu renseigner un taux manuel (fallback) maintenant ?`
      );
      if (ok && typeof window.tbFxEnsureEurRatesInteractive === "function") {
        const out = window.tbFxEnsureEurRatesInteractive(missing, "Taux du jour manquant — fallback manuel");
        if (out && out.ok) {
          const manual2 = _fxGetManualRates();
          Object.assign(effective, manual2 || {});
        }
      }
    }

    // Recompute base rate using effective rates (auto + manual fallbacks)
    if (base && String(base).toUpperCase() !== "EUR") {
      const b = String(base).toUpperCase();
      const eurToBase = Number(effective?.[b]);
      if (!eurToBase || eurToBase <= 0) {
        return alert(
          `Taux indisponible pour ${b}.\n` +
          `→ Renseigne un taux manuel EUR→${b} (fallback), ou choisis une devise supportée.`
        );
      }
      // keep local rates store: provider rates only, manual is stored separately
      state.exchangeRates["EUR-BASE"] = eurToBase;
      state.exchangeRates["BASE-EUR"] = 1 / eurToBase;
      // continue below and persist eur_base_rate with eurToBase
    }
  } catch (e) {
    console.warn("[fx] missing-required prompt failed:", e?.message || e);
  }

  // 4) Stockage local (utilisé par le plugin cross-rate)
  _fxSetEurRates(allRates);
  try { _fxSetLastDaily(_fxTodayKey()); } catch (_) {}

  // 5) On continue à alimenter ton moteur actuel EUR<->BASE
  const eurToBaseNow = (base === "EUR") ? 1 : Number(state.exchangeRates["EUR-BASE"] || allRates[base]);
  state.exchangeRates["EUR-BASE"] = eurToBaseNow;
  state.exchangeRates["BASE-EUR"] = 1 / eurToBaseNow;

  // 6) Persist côté DB (comme avant)
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
  const promptMissingRequired = !!o.promptMissingRequired;

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
      _fxPromptUpdateManualIfNeeded();

      // Optional: after a successful daily refresh, prompt for missing required currencies.
      // Disabled by default to avoid prompts during boot; enable from explicit user actions.
      if (promptMissingRequired) {
        try {
          const base = String(window.state?.period?.baseCurrency || "").toUpperCase();
          const required = new Set();
          if (base) required.add(base);
          (Array.isArray(window.state?.wallets) ? window.state.wallets : []).forEach(w => {
            const c = String(w?.currency || "").toUpperCase();
            if (c) required.add(c);
          });
          (Array.isArray(window.state?.budgetSegments) ? window.state.budgetSegments : []).forEach(s => {
            const c = String(s?.base_currency || s?.baseCurrency || "").toUpperCase();
            if (c) required.add(c);
          });
          const merged = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : (_fxGetEurRates() || {});
          const missing = Array.from(required).filter(c => c && c !== "EUR" && !(Number(merged?.[c]) > 0));
          if (missing.length && typeof window.tbFxEnsureEurRatesInteractive === "function") {
            const ok = confirm(
              `Certaines devises n'ont pas de taux auto aujourd'hui : ${missing.join(", ")}.\n\n` +
              `Souhaites-tu renseigner un taux manuel (fallback) maintenant ?`
            );
            if (ok) window.tbFxEnsureEurRatesInteractive(missing, "Taux du jour manquant — fallback manuel");
          }
        } catch (_) {}
      }

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

function tbFxApplyToState(opts = {}) {
  try {
    if (!window.state || !window.state.period) return;
    const base = String(window.state.period.baseCurrency || "").toUpperCase();
    if (!base) return;

    const ratesMerged = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : (_fxGetEurRates() || {});
    let eurToBase = (base === "EUR") ? 1 : Number(ratesMerged[base]);

    // If missing, allow a one-shot prompt (at most once per day) to register a manual fallback.
    if ((!eurToBase || !Number.isFinite(eurToBase) || eurToBase <= 0) && base !== "EUR") {
      const allowPrompt = !!opts.allowPrompt;
      if (allowPrompt) {
        const dayKey = TB_CONST?.LS_KEYS?.fx_manual_prompted_day;
        const today = new Date().toISOString().slice(0,10);
        let last = null;
        try { last = dayKey ? localStorage.getItem(dayKey) : null; } catch (_) {}
        if (last !== today) {
          try { if (dayKey) localStorage.setItem(dayKey, today); } catch (_) {}
          const r = tbFxPromptManualRate(base, "Devise de base — taux auto indisponible");
          if (r) eurToBase = Number(r);
        }
      }
    }

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
   Interactive helpers
   - Ensure required EUR->XXX rates exist before critical write paths.
   ========================= */

function tbFxEnsureEurRatesInteractive(currencies, reason) {
  const list = Array.isArray(currencies) ? currencies : [currencies];
  const why = String(reason || "Taux requis");
  const merged = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : (_fxGetEurRates() || {});
  const miss = [];

  for (const cRaw of list) {
    const c = String(cRaw || "").trim().toUpperCase();
    if (!c || c === "EUR") continue;
    const v = Number(merged?.[c]);
    if (!(v > 0) || !Number.isFinite(v)) miss.push(c);
  }

  if (!miss.length) return { ok: true, missing: [] };
  if (typeof window.tbFxPromptManualRate !== "function") {
    return { ok: false, missing: miss, error: "tbFxPromptManualRate() missing" };
  }

  for (const c of miss) {
    const r = window.tbFxPromptManualRate(c, why);
    if (!r) return { ok: false, missing: miss, cancelled: true };
  }

  // Apply immediately (may affect baseCurrency conversions)
  try { if (typeof window.tbFxApplyToState === "function") window.tbFxApplyToState({ allowPrompt: false }); } catch (_) {}
  return { ok: true, missing: [] };
}
window.tbFxEnsureEurRatesInteractive = tbFxEnsureEurRatesInteractive;

/* =========================
   FX API (cross-rate via EUR_RATES)
   - Source of truth: localStorage EUR_RATES (EUR->XXX), + fallback period.eurBaseRate for baseCurrency
   - Expose: window.fxRate(from,to[,rates]), window.fxConvert(amount,from,to[,rates]), window.safeFxConvert(...)
   ========================= */

function fxGetEurRates() { return fxGetEurRatesMerged(); }

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
window.tbFxSetManualRate = tbFxSetManualRate;
window.tbFxDeleteManualRate = tbFxDeleteManualRate;
window.tbFxGetManualRates = tbFxGetManualRates;


// =========================
// Currency helpers (V6.6)
// - Used by Settings UI to avoid free-text currencies
// =========================

// Return true if the FX provider cache contains a EUR-><cur> rate (i.e., auto FX available).
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
    // common travel currencies fallback (in case rates not fetched yet)
    ["USD","GBP","CHF","THB","AUD","CAD","NZD","JPY","SEK","NOK","DKK","BRL","MXN","MAD","XOF"].forEach(c => set.add(c));
    return Array.from(set).sort();
  } catch (_) {
    return ["EUR","USD","GBP","CHF","THB"].sort();
  }
}
