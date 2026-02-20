/* =========================
   FX (ECB)
   - stocke tous les taux ECB (EUR->XXX) en localStorage
   - garde ton eur_base_rate pour la période
   ========================= */

function _fxSetEurRates(rates) {
  try { localStorage.setItem("EUR_RATES", JSON.stringify(rates || {})); } catch (_) {}
}
function _fxGetEurRates() {
  try { return JSON.parse(localStorage.getItem("EUR_RATES") || "{}"); } catch (_) { return {}; }
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
    .from("periods")
    .update({ eur_base_rate: eurToBaseNow, updated_at: new Date().toISOString() })
    .eq("id", state.period.id);

  if (upErr) return alert(upErr.message);

  await refreshFromServer();
  alert(`Taux mis à jour ✅`);
}
