/* =========================
   Wallet adjust
   ========================= */
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

    const val = parseFloat(String(raw).replace(",", "."));
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
