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

export function normalizeTripCurrency(currency, fallback = 'EUR') {
  const fb = String(fallback || 'EUR').trim().toUpperCase();
  const value = String(currency || fb).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : fb;
}

export function normalizeTripExpenseInput(input = {}, options = {}) {
  const fallbackCurrency = options.fallbackCurrency || 'EUR';
  const amount = Number(input.amount);
  const date = String(input.date || '').trim();
  const label = String(input.label || '').trim();
  const paidByMemberId = String(input.paidByMemberId || '').trim();
  const budgetDateStart = String(input.budgetDateStart || date || '').trim();
  const budgetDateEnd = String(input.budgetDateEnd || budgetDateStart || date || '').trim();

  if (!date) throw new Error('Date requise.');
  if (!label) throw new Error('Libelle requis.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant depense invalide.');
  if (!paidByMemberId) throw new Error('Selectionne qui a paye.');

  return {
    expenseId: input.expenseId || null,
    date,
    label,
    amount,
    currency: normalizeTripCurrency(input.currency, fallbackCurrency),
    paidByMemberId,
    walletId: input.walletId || '',
    category: String(input.category || 'Autre').trim() || 'Autre',
    subcategory: String(input.subcategory || '').trim() || null,
    budgetDateStart: budgetDateStart || date,
    budgetDateEnd: budgetDateEnd || budgetDateStart || date,
    outOfBudget: input.outOfBudget === true,
  };
}

function splitEqual(amount, memberIds) {
  const amt = Number(amount);
  const n = Array.isArray(memberIds) ? memberIds.length : 0;
  if (!Number.isFinite(amt) || amt <= 0 || n <= 0) return [];
  const cents = Math.round(amt * 100);
  const base = Math.floor(cents / n);
  let rem = cents - base * n;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const c = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    out.push(c / 100);
  }
  return out;
}

export function computeTripSplitParts(amount, members = [], split = {}) {
  const ids = members.map((m) => String(m?.id || '')).filter(Boolean);
  const selectedIds = Array.isArray(split?.selectedMemberIds)
    ? split.selectedMemberIds.map(String).filter(Boolean)
    : ids.slice();
  const selectedSet = new Set(selectedIds);
  const activeIds = ids.filter((id) => selectedSet.has(String(id)));
  const mode = split?.mode || 'equal';
  const totalCents = Math.round((Number(amount) || 0) * 100);

  if (!ids.length) return [];
  if (totalCents <= 0) return ids.map(() => 0);

  if (mode === 'equal') {
    if (!activeIds.length) throw new Error('Selectionne au moins un participant pour la repartition.');
    const selectedParts = splitEqual(Number(amount), activeIds);
    const byId = new Map(activeIds.map((id, i) => [String(id), selectedParts[i] || 0]));
    return ids.map((id) => Number(byId.get(String(id)) || 0));
  }

  if (mode === 'percent') {
    const pcts = split?.percents || {};
    const pctList = ids.map((id) => {
      if (!selectedSet.has(String(id))) return 0;
      const v = Number(pcts[id]);
      return Number.isFinite(v) ? v : (activeIds.length ? 100 / activeIds.length : 0);
    });
    const sumPct = pctList.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sumPct) || sumPct <= 0) {
      throw new Error('Repartition en % invalide : renseigne des pourcentages (>0).');
    }

    const normalized = Math.abs(sumPct - 100) > 0.01
      ? pctList.map((p) => (p * 100) / sumPct)
      : pctList;
    const cents = normalized.map((p) => Math.floor(totalCents * (p / 100)));
    let delta = totalCents - cents.reduce((a, b) => a + b, 0);
    const remainders = normalized
      .map((p, i) => ({ i, r: (totalCents * (p / 100)) - cents[i] }))
      .filter((x) => normalized[x.i] > 0)
      .sort((a, b) => b.r - a.r);

    let k = 0;
    while (delta > 0 && remainders.length && k < remainders.length * 2) {
      cents[remainders[k % remainders.length].i] += 1;
      delta -= 1;
      k += 1;
    }
    return cents.map((c) => c / 100);
  }

  if (mode === 'amount') {
    const amounts = split?.amounts || {};
    const cents = ids.map((id) => {
      if (!selectedSet.has(String(id))) return 0;
      const v = Number(amounts[id]);
      return Number.isFinite(v) ? Math.round(v * 100) : 0;
    });
    const diff = totalCents - cents.reduce((a, b) => a + b, 0);
    if (Math.abs(diff) > 1) {
      throw new Error('Repartition en montants invalide : la somme doit egaler le total.');
    }
    if (diff !== 0) {
      const lastActiveIdx = ids.map(String).findLastIndex((id) => selectedSet.has(id));
      if (lastActiveIdx >= 0) cents[lastActiveIdx] += diff;
    }
    return cents.map((c) => c / 100);
  }

  return ids.map(() => 0);
}

export function validateTripExpenseMutation({ input, members = [], shares, payer, wallet, paidByMe }) {
  if (!Array.isArray(members) || members.length === 0) {
    return { ok: false, reason: 'Ajoute au moins un participant.' };
  }
  if (!members.some((m) => String(m?.id || '') === String(input?.paidByMemberId || ''))) {
    return { ok: false, reason: 'Payeur Trip invalide.' };
  }
  const splitValidation = validateSplitTotal({ total: Number(input?.amount), shares });
  if (!splitValidation.ok) return splitValidation;

  const isPaidByMe = paidByMe === undefined ? !!payer?.isMe : !!paidByMe;
  if (isPaidByMe) {
    if (!input?.walletId) return { ok: false, reason: 'Choisis une wallet (pour decompter le paiement).' };
    if (!wallet) return { ok: false, reason: 'Wallet invalide.' };
    const walletCurrency = normalizeTripCurrency(wallet.currency, input.currency);
    if (walletCurrency !== input.currency) {
      return { ok: false, reason: `Devise wallet (${wallet.currency}) differente de la depense (${input.currency}). Choisis une wallet dans la meme devise.` };
    }
  }

  return { ok: true };
}

export function buildTripExpenseRpcPayload({ input, members = [], shares = [], walletTxEnabled = false }) {
  return {
    expense_id: input?.expenseId || null,
    date: input.date,
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    paid_by_member_id: input.paidByMemberId,
    category: input.category || 'Autre',
    subcategory: input.subcategory || null,
    budget_date_start: input.budgetDateStart || input.date,
    budget_date_end: input.budgetDateEnd || input.budgetDateStart || input.date,
    shares: members.map((m, i) => ({
      member_id: m.id,
      share_amount: shares[i] ?? 0,
    })),
    wallet_tx: { enabled: !!walletTxEnabled },
  };
}
