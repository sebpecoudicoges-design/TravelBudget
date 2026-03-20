/* =========================
   FX Cross-rate (thin patch)
   - single source of truth is window.fxConvert / window.fxRate (defined in 09_fx.js)
   - here we only patch amountToBase / amountToEUR if they exist
   ========================= */
(function () {
  if (typeof window.fxConvert !== "function") return;

  const originalAmountToBase = window.amountToBase;
  const originalAmountToEUR  = window.amountToEUR;

  if (typeof originalAmountToBase === "function") {
    window.amountToBase = function (amount, currency) {
      const base = window.state?.period?.baseCurrency;
      if (!base) return originalAmountToBase(amount, currency);

      const out = window.fxConvert(amount, currency, base);
      if (out === null || !isFinite(out)) return originalAmountToBase(amount, currency);
      return out;
    };
  }

  if (typeof originalAmountToEUR === "function") {
    window.amountToEUR = function (amount, currency) {
      const out = window.fxConvert(amount, currency, "EUR");
      if (out === null || !isFinite(out)) return originalAmountToEUR(amount, currency);
      return out;
    };
  }
})();
