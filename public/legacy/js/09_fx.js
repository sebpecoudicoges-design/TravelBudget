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
  if (!sbUser) return alert("Non connecté.");

  const { data, error } = await sb.functions.invoke("fx-latest");
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
  if (r && r > 0) return r;

  // Fallback: baseCurrency via eurBaseRate (if available)
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
