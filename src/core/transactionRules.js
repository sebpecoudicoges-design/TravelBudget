// Core transaction rules.
// Pure helpers shared by legacy UI and tests.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TRANSACTION_TYPES = new Set(['expense', 'income']);

export function parseLocaleAmount(input) {
  let s = String(input ?? '').trim();
  if (!s) return NaN;

  s = s.replace(/[\s\u00A0\u202F]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function isISODate(value) {
  return ISO_DATE_RE.test(String(value || '').trim());
}

export function isNightCoveredEligibleCategory(category) {
  return /^transport( internationale?| international)?$/i.test(String(category || '').trim());
}

export function normalizeTransactionInput(input = {}) {
  const type = String(input.type || '').trim();
  const walletId = String(input.walletId || '').trim();
  const amount = typeof input.amount === 'number' ? input.amount : parseLocaleAmount(input.amount);
  const category = String(input.category || '').trim() || 'Autre';
  const subcategory = String(input.subcategory || '').trim() || null;
  const cashDate = String(input.cashDate || input.dateStart || '').slice(0, 10);
  const budgetDateStart = String(input.budgetDateStart || input.dateStart || cashDate).slice(0, 10);
  const budgetDateEnd = String(input.budgetDateEnd || input.dateEnd || budgetDateStart || cashDate).slice(0, 10);
  const label = String(input.label || '').trim() || category;
  const payNow = !!input.payNow;
  const outOfBudget = !!input.outOfBudget;
  const eligibleNightCovered = type === 'expense' && isNightCoveredEligibleCategory(category);

  return {
    type,
    walletId,
    amount,
    category,
    subcategory,
    cashDate,
    dateStart: cashDate,
    dateEnd: cashDate,
    budgetDateStart,
    budgetDateEnd,
    label,
    payNow,
    outOfBudget,
    nightCovered: eligibleNightCovered ? !!input.nightCovered : false,
    affectsBudget: input.affectsBudget === undefined ? !outOfBudget : !!input.affectsBudget,
    tripExpenseId: input.tripExpenseId || null,
    tripShareLinkId: input.tripShareLinkId || null,
  };
}

export function validateTransactionInput(tx, options = {}) {
  if (!tx || typeof tx !== 'object') return { ok: false, reason: 'Transaction invalide.' };
  if (!TRANSACTION_TYPES.has(tx.type)) return { ok: false, reason: 'Type de transaction invalide.' };
  if (!tx.walletId) return { ok: false, reason: 'Wallet invalide.' };
  if (!Number.isFinite(tx.amount) || tx.amount <= 0) return { ok: false, reason: 'Montant invalide.' };
  if (!isISODate(tx.cashDate)) return { ok: false, reason: 'Date tresorerie invalide.' };
  if (!isISODate(tx.budgetDateStart) || !isISODate(tx.budgetDateEnd)) {
    return { ok: false, reason: 'Dates budget invalides.' };
  }
  if (tx.budgetDateEnd < tx.budgetDateStart) {
    return { ok: false, reason: 'Date budget fin < date budget debut.' };
  }
  if (options.requireCurrency && !String(tx.currency || '').trim()) {
    return { ok: false, reason: 'Devise invalide.' };
  }
  return { ok: true };
}

export function validateTripLinkedEdit(next, current) {
  if (!isTripLinkedTransaction(current)) return { ok: true };
  if (next.walletId !== current.walletId) return { ok: false, reason: 'Transaction liee a Trip : changement de wallet interdit.' };
  if (next.type !== current.type) return { ok: false, reason: 'Transaction liee a Trip : changement de type interdit.' };
  if (Math.abs(Number(next.amount) - Number(current.amount)) > 0.0001) {
    return { ok: false, reason: 'Transaction liee a Trip : changement de montant interdit (modifie la depense Trip a la place).' };
  }
  if (
    String(next.cashDate) !== String(current.dateStart) ||
    String(next.budgetDateStart) !== String(current.budgetDateStart) ||
    String(next.budgetDateEnd) !== String(current.budgetDateEnd)
  ) {
    return { ok: false, reason: 'Transaction liee a Trip : changement de dates interdit.' };
  }
  if (!!next.payNow !== !!current.payNow) return { ok: false, reason: 'Transaction liee a Trip : changement pay_now interdit.' };
  if (!!next.outOfBudget !== !!current.outOfBudget) {
    return { ok: false, reason: 'Transaction liee a Trip : flag out_of_budget gere automatiquement.' };
  }
  return { ok: true };
}

export function isTripLinkedTransaction(tx) {
  return !!(
    tx?.tripExpenseId ||
    tx?.trip_expense_id ||
    tx?.tripShareLinkId ||
    tx?.trip_share_link_id
  );
}

export function isWalletAdjustmentTransaction(tx, options = {}) {
  const categoryName = String(options.walletAdjustmentCategory || 'Ajustement wallet').trim().toLowerCase();
  const category = String(tx?.category || '').trim().toLowerCase();
  const label = String(tx?.label || '').trim().toLowerCase();
  return category === categoryName || label.startsWith(`${categoryName} `) || label.startsWith(`${categoryName} -`);
}
