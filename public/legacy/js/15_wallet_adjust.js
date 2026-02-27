/* =========================
   Wallet adjust
   ========================= */
async function adjustWalletBalance(walletId) {
  await safeCall("Ajuster solde", async () => {
    const w = findWallet(walletId);
    if (!w) throw new Error("Wallet introuvable.");

    const raw = prompt(`Solde actuel pour "${w.name}" (${w.currency}) :\n\n(Info: on recalcule le solde de base pour que le solde affiché corresponde, en tenant compte des transactions déjà payées.)`, String(w.balance));
    if (raw === null) return;

    const val = parseFloat(String(raw).replace(",", "."));
    if (!isFinite(val)) throw new Error("Nombre invalide.");

    // Recalibrate baseline so that the *displayed* balance (baseline + paid tx) equals the user-entered current balance.
    let paidDelta = 0;
    try {
      const wid = String(walletId);
      const targetCur = String(w.currency || "").toUpperCase();
      for (const tx of (state.transactions || [])) {
        if (!tx) continue;
        const txWid = String(tx.walletId ?? tx.wallet_id ?? "");
        if (txWid !== wid) continue;
        const paid = !!(tx.payNow ?? tx.pay_now);
        if (!paid) continue;
        let amt = Number(tx.amount || 0);
        if (!isFinite(amt) || amt === 0) continue;
        const txCur = String(tx.currency || targetCur).toUpperCase();
        if (txCur !== targetCur && typeof window.fxConvert === "function") {
          amt = Number(window.fxConvert(amt, txCur, targetCur));
        }
        const t = String(tx.type || "").toLowerCase();
        if (t === "income") paidDelta += amt;
        else if (t === "expense") paidDelta -= amt;
      }
    } catch (_) {}

    const baseline = val - paidDelta;
    const { error } = await sb.from(TB_CONST.TABLES.wallets).update({ balance: baseline }).eq("id", walletId);
    if (error) throw error;

    await refreshFromServer();
  });
}

