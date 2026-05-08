export function computeWalletBalanceRows(walletRows, transactionRows, periodId = null) {
  const rows = [];
  const txByWallet = new Map();

  for (const tx of (Array.isArray(transactionRows) ? transactionRows : [])) {
    const walletId = String(tx?.wallet_id ?? tx?.walletId ?? '');
    if (!walletId) continue;
    if (!txByWallet.has(walletId)) txByWallet.set(walletId, []);
    txByWallet.get(walletId).push(tx);
  }

  for (const wallet of (Array.isArray(walletRows) ? walletRows : [])) {
    const walletPeriodId = wallet?.period_id ?? wallet?.periodId ?? null;
    if (periodId && String(walletPeriodId || '') !== String(periodId)) continue;

    const walletId = String(wallet?.id || '');
    const snapshotRaw = wallet?.balance_snapshot_at ?? wallet?.balanceSnapshotAt ?? null;
    const snapshot = snapshotRaw ? new Date(snapshotRaw).getTime() : null;
    let delta = 0;
    let included = 0;
    let excludedInternal = 0;
    let excludedUnpaid = 0;
    let excludedPreSnapshot = 0;
    let lastTxCreatedAt = null;

    for (const tx of (txByWallet.get(walletId) || [])) {
      const isInternal = !!(tx?.is_internal ?? tx?.isInternal);
      const payNow = (tx?.pay_now ?? tx?.payNow) !== false;
      const createdAtRaw = tx?.created_at ?? tx?.createdAt ?? null;
      const createdAtMs = createdAtRaw ? new Date(createdAtRaw).getTime() : NaN;

      if (!payNow) { excludedUnpaid += 1; continue; }
      if (isInternal) { excludedInternal += 1; continue; }
      if (snapshot && Number.isFinite(createdAtMs) && createdAtMs < snapshot) {
        excludedPreSnapshot += 1;
        continue;
      }

      const amount = Number(tx?.amount || 0);
      const type = String(tx?.type || '');
      if (type === 'income') delta += amount;
      else if (type === 'expense') delta -= amount;

      included += 1;
      if (createdAtRaw && (!lastTxCreatedAt || String(createdAtRaw) > String(lastTxCreatedAt))) {
        lastTxCreatedAt = createdAtRaw;
      }
    }

    const baseline = Number(wallet?.balance || 0);
    rows.push({
      wallet_id: wallet?.id,
      period_id: walletPeriodId || periodId || null,
      wallet_currency: wallet?.currency || null,
      baseline_balance: baseline,
      balance_snapshot_at: snapshotRaw,
      transactions_delta: delta,
      effective_balance: baseline + delta,
      included_tx_count: included,
      excluded_internal_count: excludedInternal,
      excluded_unpaid_count: excludedUnpaid,
      excluded_pre_snapshot_count: excludedPreSnapshot,
      last_tx_created_at: lastTxCreatedAt,
    });
  }

  return rows;
}
