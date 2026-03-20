/* =========================
   Health Check (non bloquant)
   - détecte incohérences data + FX manquants
   ========================= */

(function () {
  function isIsoCurrency(c) {
    return /^[A-Z]{3}$/.test(String(c || ""));
  }

  function getAllCashWallets() {
    const ws = (window.state?.wallets || []);
    const hasType = ws.some(w => typeof w?.type === "string" && w.type.length > 0);
    if (hasType) return ws.filter(w => (w?.type || "other") === "cash");
    return ws.filter(w => String(w?.name || "").toLowerCase().includes("cash"));
  }

  function hasFxFor(currency, base) {
    // Your current engine: always ok if same; EUR<->base uses EUR-BASE
    if (!currency || !base) return false;
    if (currency === base) return true;
    if (currency === "EUR") return !!(window.state?.exchangeRates?.["EUR-BASE"]);
    // other currencies not convertible with current engine
    return false;
  }

  function runHealthCheck() {
    const state = window.state;
    if (!state?.period) return;

    const issues = [];

    // Period sanity
    if (!state.period.baseCurrency || !isIsoCurrency(state.period.baseCurrency)) {
      issues.push("Devise période invalide");
    }
    if (!state.period.start || !state.period.end) {
      issues.push("Période: dates manquantes");
    }

    // Wallet sanity
    for (const w of (state.wallets || [])) {
      if (!w.name) issues.push("Wallet sans nom");
      if (!isIsoCurrency(w.currency)) issues.push(`Wallet "${w.name || "?"}": devise invalide (${w.currency})`);
      if (w.balance === undefined || w.balance === null || !isFinite(Number(w.balance))) {
        issues.push(`Wallet "${w.name || "?"}": solde invalide`);
      }
      if (w.type !== undefined && !["cash", "bank", "card", "savings", "other"].includes(w.type)) {
        issues.push(`Wallet "${w.name || "?"}": type invalide (${w.type})`);
      }
    }

    // FX sanity for cash wallets
    const base = state.period.baseCurrency;
    const cash = getAllCashWallets();
    const fxMissing = [...new Set(cash.map(w => w.currency).filter(c => c && !hasFxFor(c, base)))];
    if (fxMissing.length) issues.push(`FX manquant pour cash: ${fxMissing.join(", ")}`);

    renderBadge(issues);
  }

  function renderBadge(issues) {
    let el = document.getElementById("healthBadge");
    if (!el) {
      el = document.createElement("div");
      el.id = "healthBadge";
      el.style.position = "fixed";
      el.style.left = "18px";
      el.style.bottom = "18px";
      el.style.zIndex = "9999";
      el.style.padding = "8px 12px";
      el.style.borderRadius = "999px";
      el.style.fontSize = "12px";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 10px 25px rgba(0,0,0,.18)";
      document.body.appendChild(el);
    }

    if (!issues.length) {
      el.textContent = "✅ Données OK";
      el.style.background = "var(--good)";
      el.style.color = "white";
      el.onclick = () => alert("Health check: aucune anomalie.");
      return;
    }

    el.textContent = `⚠ ${issues.length} alertes`;
    el.style.background = "var(--warn)";
    el.style.color = "white";
    el.onclick = () => alert("Health check:\n\n" + issues.map(x => "• " + x).join("\n"));
  }

  // Hook refreshAll if present
  function hook() {
    if (typeof window.refreshAll === "function") {
      const orig = window.refreshAll;
      window.refreshAll = async function () {
        await orig();
        runHealthCheck();
      };
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    hook();
    setTimeout(runHealthCheck, 1000);
  });
})();
