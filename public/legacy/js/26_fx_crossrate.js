/* =========================
   FX Cross-rate via EUR (plugin)
   - expose fxRate(from,to) et fxConvert(amount,from,to)
   - patch amountToBase / amountToEUR si disponibles
   ========================= */
(function () {
  function getEurRates() {
    try { return JSON.parse(localStorage.getItem("EUR_RATES") || "{}"); }
    catch (_) { return {}; }
  }

  function fxRate(from, to) {
    if (!from || !to) return null;
    if (from === to) return 1;

    const rates = getEurRates();

    const eurToFrom = (from === "EUR") ? 1 : Number(rates[from]);
    const eurToTo   = (to === "EUR")   ? 1 : Number(rates[to]);

    if (!eurToFrom || !eurToTo) return null;

    // cross-rate : (EUR->to) / (EUR->from)
    return eurToTo / eurToFrom;
  }

  function fxConvert(amount, from, to) {
    const r = fxRate(from, to);
    if (!r) return null;
    return (Number(amount) || 0) * r;
  }

  // Expose
  window.fxRate = fxRate;
  window.fxConvert = fxConvert;

  // Patch conversions globales si elles existent (function declarations => global)
  const originalAmountToBase = window.amountToBase;
  const originalAmountToEUR  = window.amountToEUR;

  if (typeof originalAmountToBase === "function") {
    window.amountToBase = function (amount, currency) {
      const base = window.state?.period?.baseCurrency;
      if (!base) return originalAmountToBase(amount, currency);

      const out = fxConvert(amount, currency, base);
      if (out === null) return originalAmountToBase(amount, currency); // fallback safe
      return out;
    };
  }

  if (typeof originalAmountToEUR === "function") {
    window.amountToEUR = function (amount, currency) {
      const out = fxConvert(amount, currency, "EUR");
      if (out === null) return originalAmountToEUR(amount, currency); // fallback safe
      return out;
    };
  }
})();
