// Core trip rules (V4.2+ validated semantics)
// Pure functions for enforcing constraints and budget-vs-cashflow behavior.

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

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

export function decideTripExpenseBudgetFlow({ amount, members = [], shares = [], tolerance = 0.005 }) {
  const total = Number(amount);
  const me = (members || []).find((member) => !!member?.isMe) || null;
  const myIdx = me ? members.findIndex((member) => String(member?.id || '') === String(me.id || '')) : -1;
  const myShare = myIdx >= 0 ? Number(shares?.[myIdx] ?? 0) : NaN;
  const hasMyShare = Number.isFinite(myShare) && myShare > 0;
  const isFullShare = Number.isFinite(total) && Number.isFinite(myShare) && Math.abs(myShare - total) < tolerance;

  return {
    mode: isFullShare ? 'single' : 'advance_and_share',
    meId: me?.id || null,
    myIdx,
    myShare,
    hasMyShare,
    isFullShare,
    missingMe: !me,
  };
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

export function validateTripExpenseMutation({ input, members = [], shares, payer, wallet, paidByMe, userId, travelId }) {
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
    const walletValidation = canUseTripWalletForExpense({
      wallet,
      userId,
      travelId,
      currency: input.currency,
    });
    if (!walletValidation.ok) return walletValidation;
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

export function buildTripTransactionRpcPayload(rawArgs = {}, { userId, today } = {}) {
  const args = rawArgs || {};
  const dateStart = args.p_date_start || args.date_start || today || '';
  const dateEnd = args.p_date_end || args.date_end || dateStart;
  const currency = args.p_currency || args.currency || null;

  return {
    p_wallet_id: args.p_wallet_id ?? null,
    p_type: args.p_type ?? null,
    p_label: args.p_label ?? null,
    p_amount: args.p_amount ?? null,
    p_currency: currency,
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_budget_date_start: (args.p_budget_date_start === undefined) ? dateStart : args.p_budget_date_start,
    p_budget_date_end: (args.p_budget_date_end === undefined) ? dateEnd : args.p_budget_date_end,
    p_category: (args.p_category === undefined) ? null : args.p_category,
    p_subcategory: (args.p_subcategory === undefined) ? null : args.p_subcategory,
    p_pay_now: !!args.p_pay_now,
    p_out_of_budget: !!args.p_out_of_budget,
    p_night_covered: !!args.p_night_covered,
    p_affects_budget: !!args.p_affects_budget,
    p_trip_expense_id: (args.p_trip_expense_id === undefined) ? null : args.p_trip_expense_id,
    p_trip_share_link_id: (args.p_trip_share_link_id === undefined) ? null : args.p_trip_share_link_id,
    p_fx_rate_snapshot: (args.p_fx_rate_snapshot === undefined) ? null : args.p_fx_rate_snapshot,
    p_fx_source_snapshot: (args.p_fx_source_snapshot === undefined) ? null : args.p_fx_source_snapshot,
    p_fx_snapshot_at: (args.p_fx_snapshot_at === undefined) ? null : args.p_fx_snapshot_at,
    p_fx_base_currency_snapshot: (args.p_fx_base_currency_snapshot === undefined) ? null : args.p_fx_base_currency_snapshot,
    p_fx_tx_currency_snapshot: (args.p_fx_tx_currency_snapshot === undefined) ? null : args.p_fx_tx_currency_snapshot,
    p_user_id: args.p_user_id ?? userId ?? null,
  };
}

export function buildTripDeleteExpenseRpcArgs({ tripId, expenseId }) {
  const cleanTripId = String(tripId || '').trim();
  const cleanExpenseId = String(expenseId || '').trim();
  if (!cleanTripId || !cleanExpenseId) {
    throw new Error('Suppression Trip invalide.');
  }
  return {
    p_trip_id: cleanTripId,
    p_expense_id: cleanExpenseId,
  };
}

export function buildTripSettlementRpcArgs({ tripId, currency, amount, fromMemberId, toMemberId }) {
  const cleanTripId = String(tripId || '').trim();
  const cleanFrom = String(fromMemberId || '').trim();
  const cleanTo = String(toMemberId || '').trim();
  const cur = normalizeTripCurrency(currency, '');
  const amt = Math.round((Number(amount) || 0) * 100) / 100;

  if (!cleanTripId || !cleanFrom || !cleanTo || !cur || !(amt > 0)) {
    throw new Error('Reglement Trip invalide.');
  }
  if (cleanFrom === cleanTo) {
    throw new Error('Les membres du reglement doivent etre differents.');
  }

  return {
    p_trip_id: cleanTripId,
    p_currency: cur,
    p_amount: amt,
    p_from_member_id: cleanFrom,
    p_to_member_id: cleanTo,
  };
}

export function computeTripAnalysis({ expenses = [], members = [], shares = [], pivot, convertAmount, categoryForExpense }) {
  const toPivot = typeof convertAmount === 'function'
    ? convertAmount
    : ((amount) => Number(amount) || 0);
  const getCategory = typeof categoryForExpense === 'function'
    ? categoryForExpense
    : ((expense) => String(expense?.category || '').trim() || 'Autre');

  const sharesByExpense = new Map();
  for (const row of shares || []) {
    const expenseId = String(row?.expenseId || '');
    if (!expenseId) continue;
    if (!sharesByExpense.has(expenseId)) sharesByExpense.set(expenseId, []);
    sharesByExpense.get(expenseId).push(row);
  }

  const categoryTotals = new Map();
  const participantTotals = new Map();
  for (const member of members || []) {
    const id = String(member?.id || '');
    if (!id) continue;
    participantTotals.set(id, {
      paid: 0,
      owed: 0,
      expenseCount: 0,
      name: member?.name || '',
      isMe: !!member?.isMe,
    });
  }

  for (const expense of expenses || []) {
    const expenseId = String(expense?.id || '');
    const amountPivot = Number(toPivot(expense?.amount, expense?.currency, expense)) || 0;
    const category = String(getCategory(expense) || '').trim() || 'Autre';
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + amountPivot);

    const payerId = String(expense?.paidByMemberId || '');
    if (payerId && participantTotals.has(payerId)) {
      const payerRow = participantTotals.get(payerId);
      payerRow.paid += amountPivot;
      payerRow.expenseCount += 1;
    }

    for (const share of sharesByExpense.get(expenseId) || []) {
      const memberId = String(share?.memberId || '');
      if (!memberId || !participantTotals.has(memberId)) continue;
      participantTotals.get(memberId).owed += Number(toPivot(share?.shareAmount, expense?.currency, expense)) || 0;
    }
  }

  const categories = Array.from(categoryTotals.entries())
    .map(([name, amount]) => ({ name, amount: round2(amount) }))
    .filter((row) => row.amount > 0.004)
    .sort((a, b) => b.amount - a.amount);

  const participants = Array.from(participantTotals.entries())
    .map(([id, row]) => ({
      id,
      name: row.name,
      isMe: row.isMe,
      paid: round2(row.paid),
      owed: round2(row.owed),
      net: round2(row.paid - row.owed),
      expenseCount: row.expenseCount || 0,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.paid - a.paid || String(a.name).localeCompare(String(b.name)));

  return { pivot, categories, participants };
}

export function normalizeTripHistoryFilters(filters = {}) {
  return {
    category: String(filters?.category || ''),
    payer: String(filters?.payer || ''),
    participant: String(filters?.participant || ''),
    dateFrom: String(filters?.dateFrom || ''),
    dateTo: String(filters?.dateTo || ''),
    amountMin: String(filters?.amountMin || ''),
    amountMax: String(filters?.amountMax || ''),
    q: String(filters?.q || ''),
  };
}

export function matchesTripHistoryFilter({ expense, category, membersById, sharesByExpense, filters }) {
  const normalized = normalizeTripHistoryFilters(filters);
  const payerId = String(expense?.paidByMemberId || '');
  const shareRows = Array.isArray(sharesByExpense)
    ? sharesByExpense
    : (sharesByExpense?.get?.(expense?.id) || []);

  if (normalized.category && String(category || '') !== normalized.category) return false;
  if (normalized.payer && payerId !== normalized.payer) return false;

  if (normalized.participant) {
    const wanted = String(normalized.participant);
    const hasPositiveShare = shareRows.some((row) =>
      String(row?.memberId || '') === wanted &&
      Number(row?.shareAmount || 0) > 0.004
    );
    if (!hasPositiveShare && payerId !== wanted) return false;
  }

  const date = String(expense?.date || '');
  if (normalized.dateFrom && date && date < normalized.dateFrom) return false;
  if (normalized.dateTo && date && date > normalized.dateTo) return false;

  const amount = Number(expense?.amount || 0);
  const amountMin = Number(normalized.amountMin);
  const amountMax = Number(normalized.amountMax);
  if (normalized.amountMin !== '' && Number.isFinite(amountMin) && amount < amountMin) return false;
  if (normalized.amountMax !== '' && Number.isFinite(amountMax) && amount > amountMax) return false;

  const q = normalized.q.trim().toLowerCase();
  if (q) {
    const getMember = (id) => membersById?.get?.(String(id)) || null;
    const payerName = String(getMember(payerId)?.name || '').toLowerCase();
    const participantNames = shareRows
      .map((row) => String(getMember(row?.memberId)?.name || '').toLowerCase())
      .join(' ');
    const haystack = [
      expense?.label || '',
      category || '',
      expense?.currency || '',
      payerName,
      participantNames,
      String(expense?.amount || ''),
    ].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

export function canUseTripWalletForExpense({ wallet, userId, travelId, tripId, currency }) {
  if (!wallet) return { ok: false, reason: 'Wallet invalide.' };
  if (userId && String(wallet.user_id || wallet.userId || '') !== String(userId)) {
    return { ok: false, reason: 'Wallet non proprietaire.' };
  }
  const wantedTravelId = String(travelId || tripId || '');
  const walletTripId = String(wallet.travel_id || wallet.travelId || '');
  if (wantedTravelId && walletTripId && walletTripId !== wantedTravelId) {
    return { ok: false, reason: 'Wallet hors voyage.' };
  }
  const walletCurrency = normalizeTripCurrency(wallet.currency, currency || 'EUR');
  const expenseCurrency = normalizeTripCurrency(currency, walletCurrency);
  if (walletCurrency !== expenseCurrency) {
    return { ok: false, reason: `Devise wallet (${wallet.currency}) differente de la depense (${expenseCurrency}). Choisis une wallet dans la meme devise.` };
  }
  return { ok: true };
}
