/* =========================
   Wallet adjust
   ========================= */
async function adjustWalletBalance(walletId) {
  await safeCall("Ajuster solde", async () => {
    const w = findWallet(walletId);
    if (!w) throw new Error("Wallet introuvable.");

    const raw = prompt(`Nouveau solde pour "${w.name}" (${w.currency}) :`, String(w.balance));
    if (raw === null) return;

    const val = parseFloat(String(raw).replace(",", "."));
    if (!isFinite(val)) throw new Error("Nombre invalide.");

    const { error } = await sb.from("wallets").update({ balance: val }).eq("id", walletId);
    if (error) throw error;

    await refreshFromServer();
  });
}

