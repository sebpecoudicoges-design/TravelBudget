// Core trip rules (V4.2+ validated semantics)
// Pure functions for enforcing constraints and budget-vs-cashflow behavior.

/**
 * Determines whether a linked payment transaction should be excluded from budget (cashflow-only).
 * Rule: only when linked to a shared expense AND the transaction represents the total payment.
 */
export function shouldAutoCashflowOnly({ linked, isPaymentTotal, total, myShare }) {
  if (!linked) return false;
  if (!isPaymentTotal) return false;
  if (!Number.isFinite(total) || !Number.isFinite(myShare)) return false;
  // shared when myShare differs materially from total
  return Math.abs(myShare - total) > 1e-9;
}

/**
 * Enforce 1 transaction = 1 trip expense (and 1 expense = 1 transaction).
 * Returns {ok:true} or {ok:false, reason}.
 */
export function validateOneToOneLink({ txTripExpenseId, expenseLinkedTxId }) {
  if (txTripExpenseId) return { ok: false, reason: 'Transaction already linked to a Trip expense.' };
  if (expenseLinkedTxId) return { ok: false, reason: 'Trip expense already linked to a transaction.' };
  return { ok: true };
}

/**
 * Validate split totals. Tolerance is configurable, defaults to 0.01.
 */
export function validateSplitTotal({ total, shares, tolerance = 0.01 }) {
  if (!Number.isFinite(total)) return { ok: false, reason: 'Total is not a finite number.' };
  if (!Array.isArray(shares) || shares.length === 0) return { ok: false, reason: 'Shares are empty.' };
  let sum = 0;
  for (const v of shares) {
    if (!Number.isFinite(v)) return { ok: false, reason: 'A share is not a finite number.' };
    if (v < 0) return { ok: false, reason: 'A share is negative.' };
    sum += v;
  }
  const diff = Math.abs(sum - total);
  if (diff > tolerance) return { ok: false, reason: `Shares sum (${sum}) differs from total (${total}).` };
  return { ok: true };
}
