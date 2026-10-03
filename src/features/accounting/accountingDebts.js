import { internalAccounting, settledAt, validDay } from './accountingRecognition.js';
const cents = n => Math.round(Number(n) * 100);
const currency = tx => String(tx.currency || '').toUpperCase();
export function debtOriginEligible(tx, debt, today, links = []) {
  return ['expense', 'income'].includes(tx.type) && Number(tx.amount) === Number(debt.openingAmount)
    && currency(tx) === debt.currency && settledAt(tx, today)
    && String(tx.cashDate || tx.dateStart || tx.date_start || '').slice(0,10) <= debt.openingDate
    && !internalAccounting(tx) && !tx.virtualBudgetOnly && !(tx.tripExpenseId ?? tx.trip_expense_id)
    && (tx.recurringInstanceStatus ?? tx.recurring_instance_status) !== 'skipped'
    && (tx.type === 'expense' || !links.some(l => String(l.transaction_id) === String(tx.id)));
}
export function repaymentEligible(tx, debt, today, links = []) {
  const date = String(tx.cashDate || tx.dateStart || tx.date_start || '').slice(0, 10);
  return tx.type === 'expense' && Number(tx.amount) > 0 && Number.isFinite(Number(tx.amount))
    && currency(tx) === debt.currency && settledAt(tx, today) && date >= debt.openingDate
    && !internalAccounting(tx) && !tx.virtualBudgetOnly
    && (tx.recurringInstanceStatus ?? tx.recurring_instance_status) !== 'skipped'
    && !(tx.tripExpenseId ?? tx.trip_expense_id)
    && !links.some(l => String(l.transaction_id) === String(tx.id));
}
// A payment remains in treasury. Only its linked principal is removed from expenses.
export function debtLedger(settings, transactions, today, links = []) {
  const debts = Array.isArray(settings.debts) ? settings.debts : [];
  const usage = new Map();
  for (const d of debts) for (const id of [d.originTransactionId, ...(d.repayments || []).map(p => p.transactionId)].filter(Boolean)) usage.set(String(id), (usage.get(String(id)) || 0) + 1);
  const principalByTransaction = new Map(), fundingTransactions = new Set(), warnings = [];
  const rows = debts.map(d => {
    let invalid = !d.id || !String(d.name || '').trim() || !/^[A-Z]{3}$/.test(d.currency || '') || !validDay(d.openingDate) || d.openingDate > today || !Number.isFinite(Number(d.openingAmount)) || Number(d.openingAmount) <= 0;
    const origin = d.originTransactionId ? transactions.find(t => String(t.id) === String(d.originTransactionId)) : null;
    if (d.originTransactionId && (!origin || usage.get(String(d.originTransactionId)) !== 1 || !debtOriginEligible(origin, d, today, links))) invalid = true;
    let paid = 0;
    const repayments = (d.repayments || []).map(p => {
      const tx = transactions.find(t => String(t.id) === String(p.transactionId));
      const valid = !!tx && usage.get(String(p.transactionId)) === 1 && repaymentEligible(tx, d, today, links)
        && Number.isFinite(Number(p.principal)) && Number(p.principal) > 0 && cents(p.principal) <= cents(tx.amount);
      if (!valid) invalid = true;
      else paid += cents(p.principal);
      return { ...p, valid, label: tx?.label || tx?.category || 'Transaction indisponible', date: tx?.cashDate || tx?.dateStart || tx?.date_start || '' };
    });
    const adjustments = (d.adjustments || []).map(a => ({ ...a, kind: 'adjustment', delta: Number(a.amount) }));
    if (adjustments.some(a => !a.id || !validDay(a.date) || a.date < d.openingDate || a.date > today || !String(a.reason || '').trim() || !Number.isFinite(a.delta) || cents(a.delta) === 0)) invalid = true;
    const history = [...adjustments, ...repayments.map(p => ({ ...p, kind: 'repayment', delta: -Number(p.principal), date: String(p.date).slice(0,10) }))]
      .sort((a,b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? String(a.id || a.transactionId).localeCompare(String(b.id || b.transactionId)) : a.kind === 'adjustment' ? -1 : 1));
    let balance = cents(d.openingAmount);
    for (const event of history) { balance += cents(event.delta); event.balance = balance / 100; if (balance < 0) invalid = true; }
    const adjusted = adjustments.reduce((n,a) => n + cents(a.delta), 0) / 100;
    if (invalid) warnings.push(`Dette « ${d.name || 'sans nom'} » : source ou remboursement à rapprocher ; solde non calculable.`);
    else {
      for (const p of repayments) principalByTransaction.set(String(p.transactionId), Number(p.principal));
      if (origin?.type === 'income') fundingTransactions.add(String(origin.id));
    }
    return { ...d, repayments, history, adjusted: invalid ? null : adjusted, paid: invalid ? null : paid / 100, remaining: invalid ? null : balance / 100 };
  });
  return { rows, principalByTransaction, fundingTransactions, warnings };
}
