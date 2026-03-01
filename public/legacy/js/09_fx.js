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
  try {
    const rates = JSON.parse(localStorage.getItem(TB_CONST.LS_KEYS.eur_rates) || "{}") || {};
    // Optional: filter by last provider keys to avoid "phantom" stale/incorrect currencies.
    let keys = null;
    try {
      const rawKeys = localStorage.getItem(TB_CONST.LS_KEYS.eur_rates_keys);
      if (rawKeys) {
        const arr = JSON.parse(rawKeys);
        if (Array.isArray(arr) && arr.length) keys = arr.map(x => String(x||"").toUpperCase()).filter(Boolean);
      }
    } catch (_) {}
    if (keys && keys.length) {
      const out = {};
      for (const k of keys) {
        if (k === "EUR") { out.EUR = 1; continue; }
        const v = Number(rates[k]);
        if (Number.isFinite(v) && v > 0) out[k] = v;
      }
      return out;
    }
    return rates;
  } catch (_) { return {}; }
}

// Manual EUR->XXX rates (fallback when Auto FX provider doesn't provide the currency)
// Stored as: { "LAK": { rate: 30769.41, asOf: "YYYY-MM-DD" }, ... }
function _fxGetManualRatesRaw() {
  try { return JSON.parse(localStorage.getItem(TB_CONST.LS_KEYS.fx_manual_rates) || "{}"); } catch (_) { return {}; }
}
function _fxGetManualAsofLegacy() {
  try {
    const raw = localStorage.getItem(TB_CONST.LS_KEYS.fx_manual_asof);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj;
    }
  } catch (_) {}
  return {};
}
function _fxNormalizeManualRates(raw) {
  const out = {};
  const legacyAsof = _fxGetManualAsofLegacy();
  const obj = raw && typeof raw === "object" ? raw : {};
  for (const [k, v] of Object.entries(obj)) {
    const c = String(k || "").trim().toUpperCase();
    if (!c || c === "EUR") continue;
    if (v && typeof v === "object") {
      const r = Number(v.rate);
      const asOf = v.asOf ? String(v.asOf).slice(0,10) : (legacyAsof[c] || null);
      if (Number.isFinite(r) && r > 0) out[c] = { rate: r, asOf: asOf || null };
    } else {
      const r = Number(v);
      const asOf = legacyAsof[c] || null;
      if (Number.isFinite(r) && r > 0) out[c] = { rate: r, asOf: asOf || null };
    }
  }
  return out;
}
function _fxGetManualRates() {
  return _fxNormalizeManualRates(_fxGetManualRatesRaw());
}
function _fxSetManualRates(mapObj) {
  try { localStorage.setItem(TB_CONST.LS_KEYS.fx_manual_rates, JSON.stringify(mapObj || {})); } catch (_) {}
}
function _fxTodayISO() {
  try { return toLocalISODate(new Date()); } catch (_) { return new Date().toISOString().slice(0,10); }
}

// Reference day for manual fallback freshness.
// If ECB auto provides an asOf date, use it (avoid weekend/holiday false prompts).
function _fxRefISO() {
  try {
    const asof = String(localStorage.getItem(TB_CONST.LS_KEYS.eur_rates_asof) || "").slice(0,10);
    if (asof) return asof;
  } catch (_) {}
  return _fxTodayISO();
}

function tbFxSetManualRate(cur, rate, asOf) {
  const c = String(cur || "").trim().toUpperCase();
  const r = Number(rate);
  if (!c || !/^[A-Z]{3}$/.test(c)) throw new Error("Code devise invalide (ISO3 attendu)");
  if (!Number.isFinite(r) || r <= 0) throw new Error("Taux invalide (doit être > 0)");
  const today = String(asOf || _fxTodayISO()).slice(0,10);
  const map = _fxGetManualRates();
  map[c] = { rate: r, asOf: today };
  _fxSetManualRates(map);

  // Keep legacy asOf map in sync (safe migration)
  try {
    const legacy = _fxGetManualAsofLegacy();
    legacy[c] = today;
    localStorage.setItem(TB_CONST.LS_KEYS.fx_manual_asof, JSON.stringify(legacy));
  } catch (_) {}

  return map;
}
function tbFxDeleteManualRate(cur) {
  const c = String(cur || "").trim().toUpperCase();
  const map = _fxGetManualRates();
  delete map[c];
  _fxSetManualRates(map);
  try {
    const legacy = _fxGetManualAsofLegacy();
    delete legacy[c];
    localStorage.setItem(TB_CONST.LS_KEYS.fx_manual_asof, JSON.stringify(legacy));
  } catch (_) {}
  return map;
}

function tbFxManualAsof(cur) {
  const c = String(cur || "").trim().toUpperCase();
  const m = _fxGetManualRates();
  return m?.[c]?.asOf || null;
}

// Prompt user for a manual rate (EUR -> CUR). Returns number or null if cancelled.
function tbFxPromptManualRate(cur, reason) {
  const c = String(cur || "").trim().toUpperCase();
  if (!c || c === "EUR") return null;
  const why = reason ? `\n(${reason})` : "";
  const existingObj = (_fxGetManualRates() || {})[c];
  const existing = existingObj ? existingObj.rate : null;
  const hint = existing ? ` (actuel: ${existing})` : "";
  const raw = prompt(`Taux requis : EUR → ${c}${hint}${why}\n\nEntre le taux (ex: 17000) :`);
  if (raw === null) return null; // user cancelled
  const r = Number(String(raw).replace(",", "."));

  // Sanity check: if an auto rate exists, warn when the manual rate differs wildly.
  try {
    const autoRates = _fxGetEurRates();
    const auto = Number(autoRates?.[c]);
    if (Number.isFinite(auto) && auto > 0 && Number.isFinite(r) && r > 0) {
      const ratio = r / auto;
      if (ratio > 5 || ratio < 0.2) {
        const ok = confirm(
          `⚠️ Ce taux manuel semble très différent du taux auto connu pour EUR→${c}.\n` +
          `Auto: ${auto}\nManuel: ${r}\n\nConfirmer l'enregistrement ?`
        );
        if (!ok) return null;
      }
    }
  } catch (_) {}

  tbFxSetManualRate(c, r, _fxTodayISO());
  return r;
}

// Option A: prompt only when the currency is actually needed.
// If a manual rate exists but is stale (asOf < today), ask:
// - OK: enter new rate for today
// - Cancel: keep same rate and mark asOf=today (explicit user confirmation)
function tbFxEnsureManualRateToday(cur, reason) {
  const c = String(cur || "").trim().toUpperCase();
  if (!c || c === "EUR") return { ok: true, cur: c, rate: 1, used: "auto" };
  const refDay = _fxRefISO();
  const m = _fxGetManualRates();
  const existing = m?.[c]?.rate || null;
  const asOf = m?.[c]?.asOf || null;

  if (!existing) {
    const r = tbFxPromptManualRate(c, reason || "Taux du jour manquant");
    if (!r) return { ok: false, cur: c, cancelled: true };
    return { ok: true, cur: c, rate: Number(r), used: "manual_new" };
  }

  if (asOf !== refDay) {
    // Single-dialog UX: prompt with current rate prefilled.
    // - Cancel or empty => keep same rate, but mark asOf=refDay (explicit confirmation).
    // - New value => store new rate for refDay.
    const raw = prompt(
      `Taux manuel EUR→${c} (dernier: ${existing} le ${asOf || "—"})\n\n` +
      `Entrez le taux pour aujourd'hui (${refDay})\n` +
      `• OK + valeur = nouveau taux\n` +
      `• OK vide ou Annuler = conserver le même`,
      String(existing)
    );
    if (raw === null) {
      tbFxSetManualRate(c, existing, refDay);
      return { ok: true, cur: c, rate: Number(existing), used: "manual_kept" };
    }
    const cleaned = String(raw || "").trim();
    if (!cleaned) {
      tbFxSetManualRate(c, existing, refDay);
      return { ok: true, cur: c, rate: Number(existing), used: "manual_kept" };
    }
    const r = Number(cleaned);
    if (!Number.isFinite(r) || r <= 0) {
      // invalid entry -> keep previous, but still mark refDay to avoid loops
      tbFxSetManualRate(c, existing, refDay);
      return { ok: true, cur: c, rate: Number(existing), used: "manual_kept" };
    }
    tbFxSetManualRate(c, r, refDay);
    return { ok: true, cur: c, rate: r, used: "manual_new" };
  }

  return { ok: true, cur: c, rate: Number(existing), used: "manual_refDay" };
}

function tbFxGetManualRates() { return _fxGetManualRates(); }

// Merge auto rates + manual rates (manual only fills missing currencies)
function fxGetEurRatesMerged() {
  const autoRates = _fxGetEurRates();
  const manualObj = _fxGetManualRates();
  const manual = {};
  try {
    for (const [c, v] of Object.entries(manualObj || {})) {
      const r = Number(v?.rate);
      if (Number.isFinite(r) && r > 0) manual[String(c).toUpperCase()] = r;
    }
  } catch (_) {}
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

  // Store provider metadata to prevent reusing stale/phantom currencies from cache.
  try {
    const asof = String(data?.asof || data?.date || "").slice(0,10) || new Date().toISOString().slice(0,10);
    const keys = Object.keys(data.rates || {}).map(k => String(k||"").toUpperCase()).filter(Boolean);
    if (!keys.includes("EUR")) keys.push("EUR");
    localStorage.setItem(TB_CONST.LS_KEYS.eur_rates_asof, asof);
    localStorage.setItem(TB_CONST.LS_KEYS.eur_rates_keys, JSON.stringify(keys));
  } catch (_) {}


  const base = state.period.baseCurrency;

  // 1) Merge provider rates with previous cache (non-destructive)
  const previous = _fxGetEurRates();
  const allRates = { ...previous, ...data.rates, EUR: 1 };

  // 2) No segment-fixed injection: Auto is source of truth; manual fallback is global-only (Option A)


  // 3) No prompt here: Auto refresh never triggers manual capture.

  // 4) Stockage local (utilisé par le plugin cross-rate)
  _fxSetEurRates(allRates);
  try { _fxSetLastDaily(_fxTodayKey()); } catch (_) {}

  // 5) On continue à alimenter ton moteur actuel EUR<->BASE
  const eurToBaseNow = (base === "EUR") ? 1 : Number(state.exchangeRates["EUR-BASE"] || allRates[base]);
  if (base !== "EUR" && (!eurToBaseNow || eurToBaseNow <= 0)) {
    return alert(`Taux auto indisponible pour ${base} (ECB).\n\n→ Utilise un taux manuel fallback pour EUR→${base} via Settings.`);
  }
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
      // Option A: no global daily prompt; prompts happen only when needed.

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
          const out = (typeof window.tbFxEnsureManualRateToday === "function")
            ? window.tbFxEnsureManualRateToday(base, "Devise de base — taux auto indisponible")
            : null;
          if (out && out.ok === true && Number(out.rate) > 0) eurToBase = Number(out.rate);
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
    const out = (typeof window.tbFxEnsureManualRateToday === "function")
      ? window.tbFxEnsureManualRateToday(c, why)
      : { ok: false, cancelled: true };
    if (!out || out.ok !== true) return { ok: false, missing: miss, cancelled: true };
  }

  // Apply immediately (may affect baseCurrency conversions)
  try { if (typeof window.tbFxApplyToState === "function") window.tbFxApplyToState({ allowPrompt: false }); } catch (_) {}
  return { ok: true, missing: [] };
}
window.tbFxEnsureEurRatesInteractive = tbFxEnsureEurRatesInteractive;

// Ensure a FX pair can be converted (from -> to). If missing, prompt manual EUR rates.
// This is more reliable than only checking presence in eurRates, because it mirrors the real conversion path.
function tbFxEnsurePairInteractive(fromCur, toCur, reason) {
  const from = String(fromCur || "").trim().toUpperCase();
  const to = String(toCur || "").trim().toUpperCase();
  if (!from || !to || from === to) return { ok: true, missing: [] };
  if (typeof window.fxRate !== "function") {
    // fallback: best-effort on EUR rates
    return tbFxEnsureEurRatesInteractive([from, to], reason);
  }

  const why = String(reason || "Taux requis");
  const rates = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : fxGetEurRatesMerged();
  const r = window.fxRate(from, to, rates);
  if (Number.isFinite(r) && r > 0) return { ok: true, missing: [] };

  // Try to determine which EUR legs are missing.
  const miss = [];
  const eur = rates || {};
  const need = [from, to];
  for (const c of need) {
    if (!c || c === "EUR") continue;
    const v = Number(eur?.[c]);
    if (!(v > 0) || !Number.isFinite(v)) miss.push(c);
  }

  if (!miss.length) {
    // Conversion failed even though legs exist; ask user to confirm/update both.
    miss.push(from, to);
  }

  const out = tbFxEnsureEurRatesInteractive(miss, why);
  if (!out || out.ok !== true) return out || { ok: false, missing: miss };

  // Re-test
  const rates2 = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : fxGetEurRatesMerged();
  const r2 = window.fxRate(from, to, rates2);
  if (Number.isFinite(r2) && r2 > 0) return { ok: true, missing: [] };
  return { ok: false, missing: miss, error: "FX conversion still unavailable" };
}
window.tbFxEnsurePairInteractive = tbFxEnsurePairInteractive;

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

  const rates = ratesOpt || fxGetEurRatesMerged();
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