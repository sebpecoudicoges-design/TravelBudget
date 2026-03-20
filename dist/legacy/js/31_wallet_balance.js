/* =========================
   Wallet balance helper
   ========================= */

function computeWalletBalance(walletId) {

  const tx = state.transactions.filter(
    t => t.wallet_id === walletId
  );

  let balance = 0;

  for (const t of tx) {

    const amount = Number(t.amount) || 0;

    if (t.type === "income") {
      balance += amount;
    } else {
      balance -= amount;
    }

  }

  return balance;

}