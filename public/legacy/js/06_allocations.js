/* =========================
   Allocations
   ========================= */
function buildAllocationsForTx(tx) {
  const allocs = [];
  if (tx.type !== "expense") return allocs;

  const start = parseISODateOrNull(tx.dateStart) || new Date();
  const end = parseISODateOrNull(tx.dateEnd) || start;
  const label = tx.label || tx.category || "Autre";

  if (!tx.outOfBudget) {
    const days = dayCountInclusive(start, end);
    const perDayBase = amountToBase(tx.amount, tx.currency) / days;

    forEachDateInclusive(start, end, (d) => {
      const dateStr = toLocalISODate(d);
      if (!periodContains(dateStr)) return;
      allocs.push({ id: uid("a"), txId: tx.id, dateStr, amountBase: perDayBase, label });
    });
  }

  if (tx.nightCovered) {
    const dateStr = tx.dateStart;
    if (periodContains(dateStr)) {
      const extra = 400;
      allocs.push({ id: uid("a"), txId: tx.id, dateStr, amountBase: extra, label: `Nuit couverte (${extra})` });
    }
  }
  return allocs;
}
function recomputeAllocations() {
  state.allocations = [];
  for (const tx of state.transactions) state.allocations.push(...buildAllocationsForTx(tx));
}

