// A historical payment is still Trip cash, even though its source can no longer be opened.
export function hasTripPaymentOrigin(tx) {
  return Boolean(tx?.tripExpenseId || tx?.trip_expense_id || tx?.detachedTripPayment || tx?.detached_trip_payment);
}
