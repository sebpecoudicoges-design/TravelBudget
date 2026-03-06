/* =========================
   Wallet adjust
   ========================= */
function tbParseLocaleNumber(input) {
  let s = String(input ?? "").trim();
  if (!s) return NaN;

  // remove spaces and nbsp used as thousands separators
  s = s.replace(/[\s\u00A0]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // assume the last separator is the decimal separator
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      s = s.replace(/,/g, "");
    } else {
      const parts = s.split(",");
      const right = parts[1] || "";
      // single comma with exactly 3 digits after => likely thousands separator
      s = (right.length === 3) ? parts.join("") : parts.join(".");
    }
  } else if (hasDot) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      const lastDot = s.lastIndexOf(".");
      const decimals = s.slice(lastDot + 1);
      s = (decimals.length === 3)
        ? s.replace(/\./g, "")
        : s.slice(0, lastDot).replace(/\./g, "") + "." + decimals;
    } else {
      const parts = s.split(".");
      const right = parts[1] || "";
      if (right.length === 3 && /^\d+$/.test(parts[0] || "") && /^\d+$/.test(right)) {
        s = parts.join("");
      }
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

async function adjustWalletBalance(walletId) {
  await safeCall("Ajuster solde", async () => {
    const w = findWallet(walletId);
    if (!w) throw new Error("Wallet introuvable.");

    const effectiveNow =
      (typeof window.tbGetWalletEffectiveBalance === "function")
        ? Number(window.tbGetWalletEffectiveBalance(walletId) || 0)
        : Number(w.balance || 0);

    const raw = prompt(
      `Nouveau solde ACTUEL pour "${w.name}" (${w.currency}) :\n\n(Reset: les transactions payées avant maintenant n'impacteront plus le solde affiché.)`,
      String(effectiveNow)
    );
    if (raw === null) return;

    const val = tbParseLocaleNumber(raw);
    if (!isFinite(val)) throw new Error("Nombre invalide.");

    // Option A (rebasing): baseline becomes the new current balance.
    // We also store a snapshot timestamp so previous paid transactions stop impacting the displayed balance.
    const baseline = val;

    const { error } = await sb
      .from(TB_CONST.TABLES.wallets)
      .update({ balance: baseline, balance_snapshot_at: new Date().toISOString() })
      .eq("id", walletId);
    if (error) throw error;

    await refreshFromServer();
  });
}
