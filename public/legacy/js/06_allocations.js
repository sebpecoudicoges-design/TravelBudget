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
    const perDayInTxCur = (Number(tx.amount) || 0) / days;

    forEachDateInclusive(start, end, (d) => {
      const dateStr = toLocalISODate(d);
      if (!periodContains(dateStr)) return;

      const seg = (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate(dateStr) : null;
      const baseCur = String(seg?.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();

      // Prefer immutable FX snapshot when compatible with this day's base currency
      let perDayBase = null;
      if (typeof window.fxTryConvertWithSnapshot === "function") {
        perDayBase = window.fxTryConvertWithSnapshot(perDayInTxCur, tx, baseCur);
      }
      if (perDayBase === null || !Number.isFinite(perDayBase)) {
        perDayBase = (typeof amountToBudgetBaseForDate === "function")
          ? amountToBudgetBaseForDate(perDayInTxCur, tx.currency, dateStr)
          : amountToBase(perDayInTxCur, tx.currency);
      }

      allocs.push({ id: uid("a"), txId: tx.id, dateStr, amountBase: perDayBase, baseCurrency: baseCur, label });
    });
  }

  if (tx.nightCovered) {
    const dateStr = tx.dateStart;
    if (periodContains(dateStr)) {
      const seg = (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate(dateStr) : null;
      const baseCur = String(seg?.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();
      const extra = 400; // in segment base currency (by convention)
      allocs.push({ id: uid("a"), txId: tx.id, dateStr, amountBase: extra, baseCurrency: baseCur, label: `Nuit couverte (${extra})` });
    }
  }
  return allocs;
}

function recomputeAllocations() {
  state.allocations = [];
  for (const tx of state.transactions) state.allocations.push(...buildAllocationsForTx(tx));
}

