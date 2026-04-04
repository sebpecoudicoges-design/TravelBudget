/* =========================
   Allocations
   ========================= */

function tbIsNightCoveredEligibleCategory(category) {
  return /^transport( internationale?| international)?$/i.test(String(category || '').trim());
}


function tbGetNightCoveredExtraForDate(dateStr) {
  const ds = String(dateStr || '').slice(0,10);
  let seg = null;
  try { if (typeof getBudgetSegmentForDate === "function") seg = getBudgetSegmentForDate(ds); } catch (_) {}
  const segId = String(seg?.id || '');
  const cur = String(seg?.baseCurrency || seg?.base_currency || state?.period?.baseCurrency || 'EUR').toUpperCase();
  const sqlRaw = Number(seg?.transportNightBudget ?? seg?.transport_night_budget ?? seg?.night_transport_budget);
  if (Number.isFinite(sqlRaw) && sqlRaw > 0) return { amount: sqlRaw, currency: cur, segId };
  let map = {};
  try { map = JSON.parse(localStorage.getItem('travelbudget_night_transport_budget_v1') || '{}') || {}; } catch (_) {}
  const raw = segId ? map[segId] : null;
  const n = Number(raw);
  return { amount: Number.isFinite(n) && n > 0 ? n : 400, currency: cur, segId };
}


function tbGetNightCoveredInsightForTx(tx, targetCurrency) {
  if (!tx || tx.type !== "expense" || !tx.nightCovered || !tbIsNightCoveredEligibleCategory(tx.category)) return null;
  const dateStr = String((typeof tbTxBudgetStart === 'function' ? tbTxBudgetStart(tx) : (tx.budgetDateStart || tx.budget_date_start || tx.dateStart || tx.date_start || '')) || '').slice(0,10);
  if (!dateStr) return null;
  const cfg = tbGetNightCoveredExtraForDate(dateStr);
  const srcCur = String(cfg.currency || state?.period?.baseCurrency || 'EUR').toUpperCase();
  const dstCur = String(targetCurrency || srcCur).toUpperCase();
  let amount = Number(cfg.amount) || 0;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  try {
    if (dstCur && srcCur && dstCur !== srcCur) {
      const seg = (typeof getBudgetSegmentForDate === 'function') ? getBudgetSegmentForDate(dateStr) : null;
      if (typeof window.fxConvert === 'function' && seg && typeof window.fxRatesForSegment === 'function') {
        const rates = window.fxRatesForSegment(seg);
        const out = window.fxConvert(amount, srcCur, dstCur, rates);
        if (out !== null && Number.isFinite(Number(out))) amount = Number(out);
      } else if (typeof amountToBudgetBaseForDate === 'function' && seg) {
        const inSegBase = amountToBudgetBaseForDate(amount, srcCur, dateStr);
        const segBase = String(seg.baseCurrency || seg.base_currency || state?.period?.baseCurrency || 'EUR').toUpperCase();
        if (segBase === dstCur) amount = Number(inSegBase) || amount;
      }
    }
  } catch (_) {}
  return {
    dateStr,
    amount: Number(amount) || 0,
    currency: dstCur || srcCur,
    sourceCurrency: srcCur,
    label: tx.label || tx.category || 'Transport',
    category: tx.category || 'Transport'
  };
}

function buildAllocationsForTx(tx) {
  const allocs = [];
  if (tx.type !== "expense") return allocs;

  const budgetStartISO = (typeof tbTxBudgetStart === 'function') ? tbTxBudgetStart(tx) : (tx.budgetDateStart || tx.budget_date_start || tx.dateStart || tx.date_start);
  const budgetEndISO = (typeof tbTxBudgetEnd === 'function') ? tbTxBudgetEnd(tx) : (tx.budgetDateEnd || tx.budget_date_end || tx.dateEnd || tx.date_end || budgetStartISO);
  const start = parseISODateOrNull(budgetStartISO) || new Date();
  const end = parseISODateOrNull(budgetEndISO) || start;
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
  return allocs;
}

function recomputeAllocations() {
  state.allocations = [];
  for (const tx of state.transactions) state.allocations.push(...buildAllocationsForTx(tx));
}

