const DEFAULT_LOW_CASH_DAYS = 14;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function iso(v) {
  return String(v || '').slice(0, 10);
}

function inRange(date, start, end) {
  const d = iso(date);
  if (!d) return false;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

function txBudgetDate(tx) {
  return iso(tx?.budgetDateStart || tx?.budget_date_start || tx?.dateStart || tx?.date_start || tx?.date || tx?.cashDate);
}

function txCashDate(tx) {
  return iso(tx?.dateStart || tx?.date_start || tx?.date || tx?.cashDate || tx?.budgetDateStart || tx?.budget_date_start);
}

function txCategory(tx) {
  return String(tx?.category || '').trim();
}

function txLabel(tx) {
  return String(tx?.label || tx?.description || tx?.category || '').trim();
}

function txCurrency(tx, fallback) {
  return String(tx?.currency || tx?.currencyCode || tx?.currency_code || fallback || '').trim().toUpperCase();
}

function walletCurrency(wallet, fallback) {
  return String(wallet?.currency || wallet?.currencyCode || wallet?.currency_code || fallback || '').trim().toUpperCase();
}

function walletBalance(wallet, walletBalanceMap) {
  const id = String(wallet?.id || wallet?.walletId || '');
  const row = id ? walletBalanceMap?.[id] : null;
  if (row && Number.isFinite(Number(row.effectiveBalance))) return num(row.effectiveBalance);
  if (Number.isFinite(Number(wallet?.effectiveBalance))) return num(wallet.effectiveBalance);
  if (Number.isFinite(Number(wallet?.balance))) return num(wallet.balance);
  if (Number.isFinite(Number(wallet?.initialBalance))) return num(wallet.initialBalance);
  return 0;
}

function amountInDisplay(amount, currency, displayCurrency, convertAmount) {
  const cur = String(currency || displayCurrency || '').toUpperCase();
  const dest = String(displayCurrency || cur || '').toUpperCase();
  const value = num(amount);
  if (!cur || cur === dest) return value;
  if (typeof convertAmount === 'function') {
    const converted = convertAmount(value, cur, dest);
    if (Number.isFinite(Number(converted))) return Number(converted);
  }
  return value;
}

function addTopCategory(map, category, value) {
  const key = String(category || '').trim() || 'Autre';
  map.set(key, num(map.get(key)) + Math.abs(num(value)));
}

function documentExpiryDate(doc) {
  return iso(doc?.expires_at || doc?.expiresAt || doc?.expiryDate || doc?.expiry_date);
}

function assetCurrencies(asset) {
  return [
    asset?.currency,
    asset?.currencyCode,
    asset?.currency_code,
    asset?.purchaseCurrency,
    asset?.purchase_currency,
    asset?.currentCurrency,
    asset?.current_currency,
    asset?.estimatedCurrency,
    asset?.estimated_currency,
  ].map((x) => String(x || '').trim().toUpperCase()).filter(Boolean);
}

export function buildAssistantSnapshot(state = {}, options = {}) {
  const today = iso(options.today || new Date().toISOString());
  const period = state.period || {};
  const start = iso(options.start || period.start || period.start_date);
  const end = iso(options.end || period.end || period.end_date);
  const displayCurrency = String(
    options.displayCurrency ||
    state.user?.baseCurrency ||
    period.baseCurrency ||
    period.base_currency ||
    'EUR'
  ).toUpperCase();
  const walletBalanceMap = state.walletBalanceMap || {};
  const convertAmount = options.convertAmount;

  const wallets = Array.isArray(state.wallets) ? state.wallets.filter(Boolean) : [];
  const transactions = Array.isArray(state.transactions) ? state.transactions.filter(Boolean) : [];
  const docs = Array.isArray(state.documents) ? state.documents.filter(Boolean) : [];
  const assets = Array.isArray(state.assets) ? state.assets.filter(Boolean) : [];

  const scopedTx = transactions.filter((tx) => inRange(txBudgetDate(tx) || txCashDate(tx), start, end));
  let walletTotal = 0;
  for (const wallet of wallets) {
    walletTotal += amountInDisplay(walletBalance(wallet, walletBalanceMap), walletCurrency(wallet, displayCurrency), displayCurrency, convertAmount);
  }

  let paidExpenses = 0;
  let pendingExpenses = 0;
  let pendingIncome = 0;
  let paidIncome = 0;
  let uncategorized = 0;
  let locked = 0;
  const categories = new Map();

  for (const tx of scopedTx) {
    const type = String(tx.type || '').toLowerCase();
    const amount = amountInDisplay(tx.amount, txCurrency(tx, displayCurrency), displayCurrency, convertAmount);
    const isPaid = !!(tx.payNow ?? tx.pay_now ?? tx.paid);
    const category = txCategory(tx);
    const label = txLabel(tx);
    const outOfBudget = !!(tx.outOfBudget ?? tx.out_of_budget) || tx.affectsBudget === false || tx.affects_budget === false;

    if (!category || /^autre$/i.test(category) || !label || /^autre$/i.test(label)) uncategorized += 1;
    if (tx.tripExpenseId || tx.trip_expense_id || tx.tripShareLinkId || tx.trip_share_link_id || tx.internalTransferId || tx.internal_transfer_id) locked += 1;

    if (type === 'expense') {
      if (isPaid) paidExpenses += Math.abs(amount);
      else pendingExpenses += Math.abs(amount);
      if (!outOfBudget) addTopCategory(categories, category || 'Autre', amount);
    } else if (type === 'income') {
      if (isPaid) paidIncome += Math.abs(amount);
      else pendingIncome += Math.abs(amount);
    }
  }

  const topCategory = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  const daysLeft = start && end && today <= end ? Math.max(0, Math.ceil((new Date(`${end}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000) + 1) : 0;
  const dailyBudget = num(options.dailyBudget || period.dailyBudgetBase || period.daily_budget_base || 0);
  const theoreticalRunwayDays = dailyBudget > 0 ? walletTotal / dailyBudget : null;

  const expiryLimit = new Date(`${today}T00:00:00`);
  expiryLimit.setDate(expiryLimit.getDate() + num(options.expiryDays, 30));
  const expiryLimitISO = iso(expiryLimit.toISOString());
  const expiringDocs = docs.filter((doc) => {
    const ex = documentExpiryDate(doc);
    return ex && ex >= today && ex <= expiryLimitISO;
  }).length;
  const untaggedDocs = docs.filter((doc) => !Array.isArray(doc.tags) || doc.tags.length === 0).length;

  const assetCurrencySet = new Set();
  for (const asset of assets) assetCurrencies(asset).forEach((cur) => assetCurrencySet.add(cur));

  return {
    today,
    start,
    end,
    displayCurrency,
    walletCount: wallets.length,
    transactionCount: scopedTx.length,
    walletTotal,
    paidExpenses,
    pendingExpenses,
    paidIncome,
    pendingIncome,
    uncategorized,
    locked,
    topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
    daysLeft,
    dailyBudget,
    theoreticalRunwayDays,
    documentCount: docs.length,
    expiringDocs,
    untaggedDocs,
    assetCount: assets.length,
    assetCurrencyCount: assetCurrencySet.size,
  };
}

export function buildAssistantQuickInsights(state = {}, options = {}) {
  const s = buildAssistantSnapshot(state, options);
  const lowCashDays = num(options.lowCashDays, DEFAULT_LOW_CASH_DAYS);
  const insights = [];

  if (!s.walletCount) {
    insights.push({ level: 'warning', code: 'no_wallet', view: 'dashboard', title: 'Wallets', body: 'Create at least one wallet before trusting cashflow projections.' });
  } else if (s.theoreticalRunwayDays !== null && s.theoreticalRunwayDays < lowCashDays) {
    insights.push({ level: 'warning', code: 'low_runway', view: 'dashboard', title: 'Cash runway', body: `At the current daily budget, cash covers about ${Math.max(0, Math.floor(s.theoreticalRunwayDays))} day(s).` });
  } else {
    insights.push({ level: 'ok', code: 'cash_visible', view: 'dashboard', title: 'Cash position', body: `Wallets total ${Math.round(s.walletTotal * 100) / 100} ${s.displayCurrency}.` });
  }

  if (s.pendingExpenses > 0 || s.pendingIncome > 0) {
    insights.push({ level: 'info', code: 'pending_cashflow', view: 'transactions', title: 'Planned cashflow', body: `Pending: ${Math.round(s.pendingExpenses * 100) / 100} ${s.displayCurrency} to pay, ${Math.round(s.pendingIncome * 100) / 100} ${s.displayCurrency} to receive.` });
  }

  if (s.topCategory) {
    insights.push({ level: 'info', code: 'top_category', view: 'analysis', title: 'Top category', body: `${s.topCategory.name} is currently the largest budget category in this period.` });
  }

  if (s.uncategorized > 0) {
    insights.push({ level: 'warning', code: 'uncategorized', view: 'transactions', title: 'Classification', body: `${s.uncategorized} transaction(s) should be classified for cleaner analysis.` });
  }

  if (s.expiringDocs > 0) {
    insights.push({ level: 'warning', code: 'expiring_docs', view: 'documents', title: 'Documents', body: `${s.expiringDocs} document(s) expire within 30 days.` });
  } else if (s.untaggedDocs > 0) {
    insights.push({ level: 'info', code: 'untagged_docs', view: 'documents', title: 'Documents', body: `${s.untaggedDocs} document(s) have no tag yet.` });
  }

  if (s.assetCurrencyCount > 1) {
    insights.push({ level: 'warning', code: 'asset_fx', view: 'assets', title: 'Assets', body: 'Assets use multiple currencies; totals should be read with FX conversion.' });
  }

  if (s.locked > 0) {
    insights.push({ level: 'info', code: 'locked_transactions', view: 'transactions', title: 'Linked transactions', body: `${s.locked} transaction(s) are linked to Trip or internal transfers; edit them from their source module.` });
  }

  if (!insights.length) {
    insights.push({ level: 'ok', code: 'no_signal', view: 'dashboard', title: 'Status', body: 'No urgent signal detected from the loaded data.' });
  }

  return insights.slice(0, num(options.limit, 6));
}

function pushUnique(out, item) {
  if (!item) return;
  const code = String(item.code || '');
  if (code && out.some((x) => String(x.code || '') === code)) return;
  out.push(item);
}

function countTripLinkedTransactions(state = {}) {
  const rows = Array.isArray(state.transactions) ? state.transactions : [];
  return rows.filter((tx) => tx?.tripExpenseId || tx?.trip_expense_id || tx?.tripShareLinkId || tx?.trip_share_link_id).length;
}

function countInternalTransferTransactions(state = {}) {
  const rows = Array.isArray(state.transactions) ? state.transactions : [];
  return rows.filter((tx) => tx?.internalTransferId || tx?.internal_transfer_id).length;
}

function countUnlinkedDocuments(state = {}) {
  const docs = Array.isArray(state.documents) ? state.documents : [];
  if (!docs.length) return 0;
  const txLinks = Array.isArray(state.transactionDocuments) ? state.transactionDocuments : [];
  const tripLinks = Array.isArray(state.tripExpenseDocuments) ? state.tripExpenseDocuments : [];
  const assetLinks = Array.isArray(state.assetDocuments) ? state.assetDocuments : [];
  if (!txLinks.length && !tripLinks.length && !assetLinks.length) return 0;
  const linked = new Set([
    ...txLinks.map((x) => x?.document_id || x?.documentId),
    ...tripLinks.map((x) => x?.document_id || x?.documentId),
    ...assetLinks.map((x) => x?.document_id || x?.documentId),
  ].map(String).filter(Boolean));
  return docs.filter((doc) => !linked.has(String(doc?.id || ''))).length;
}

export function buildAssistantContextualInsights(state = {}, options = {}) {
  const view = String(options.view || 'dashboard').toLowerCase();
  const s = buildAssistantSnapshot(state, options);
  const global = buildAssistantQuickInsights(state, { ...options, limit: 8 });
  const out = [];

  const addByCode = (code) => pushUnique(out, global.find((x) => x.code === code));

  if (view === 'transactions') {
    addByCode('uncategorized');
    addByCode('pending_cashflow');
    addByCode('locked_transactions');
    if (s.transactionCount === 0) {
      pushUnique(out, { level: 'warning', code: 'no_transactions', view: 'transactions', title: 'Transactions', body: 'No transaction is loaded for the current period.' });
    }
    const tripLinked = countTripLinkedTransactions(state);
    const internal = countInternalTransferTransactions(state);
    if (tripLinked > 0) pushUnique(out, { level: 'info', code: 'trip_linked_tx', view: 'trip', title: 'Trip links', body: `${tripLinked} transaction(s) are linked to Trip expenses.` });
    if (internal > 0) pushUnique(out, { level: 'info', code: 'internal_transfers', view: 'transactions', title: 'Internal transfers', body: `${internal} transaction(s) belong to internal wallet transfers.` });
  } else if (view === 'documents') {
    addByCode('expiring_docs');
    addByCode('untagged_docs');
    if (s.untaggedDocs > 0) {
      pushUnique(out, { level: 'info', code: 'untagged_docs', view: 'documents', title: 'Documents', body: `${s.untaggedDocs} document(s) have no tag yet.` });
    }
    const unlinked = countUnlinkedDocuments(state);
    if (s.documentCount === 0) {
      pushUnique(out, { level: 'warning', code: 'no_documents', view: 'documents', title: 'Documents', body: 'No document is loaded yet.' });
    } else if (unlinked > 0) {
      pushUnique(out, { level: 'info', code: 'unlinked_documents', view: 'documents', title: 'Document links', body: `${unlinked} document(s) are not linked to a transaction, Trip expense or asset.` });
    }
  } else if (view === 'assets') {
    addByCode('asset_fx');
    if (s.assetCount === 0) {
      pushUnique(out, { level: 'info', code: 'no_assets', view: 'assets', title: 'Assets', body: 'No asset is loaded yet. Add assets only for items worth tracking over time.' });
    }
    if (s.documentCount > 0) {
      pushUnique(out, { level: 'info', code: 'asset_docs_hint', view: 'documents', title: 'Asset documents', body: 'Use linked documents for invoices, warranties and ownership proofs.' });
    }
  } else if (view === 'analysis') {
    addByCode('top_category');
    addByCode('uncategorized');
    addByCode('asset_fx');
    if (s.transactionCount === 0) {
      pushUnique(out, { level: 'warning', code: 'analysis_no_tx', view: 'transactions', title: 'Analysis input', body: 'Analysis needs transactions in the selected period.' });
    }
  } else if (view === 'trip') {
    const tripLinked = countTripLinkedTransactions(state);
    if (tripLinked > 0) pushUnique(out, { level: 'info', code: 'trip_linked_tx', view: 'transactions', title: 'Trip transactions', body: `${tripLinked} linked transaction(s) exist. Edit Trip expenses from Split when the amount or payer changes.` });
    addByCode('locked_transactions');
    addByCode('pending_cashflow');
  } else if (view === 'settings') {
    if (!Array.isArray(state.budgetSegments) || state.budgetSegments.length === 0) {
      pushUnique(out, { level: 'warning', code: 'no_periods', view: 'settings', title: 'Periods', body: 'Create at least one period with dates, currency and daily budget.' });
    }
    if (!s.walletCount) pushUnique(out, global.find((x) => x.code === 'no_wallet'));
    pushUnique(out, { level: 'info', code: 'settings_review', view: 'settings', title: 'Settings', body: 'Review base currency, UI mode, periods and recurring rules before relying on projections.' });
  } else {
    addByCode('cash_visible');
    addByCode('low_runway');
    addByCode('pending_cashflow');
    addByCode('top_category');
    addByCode('expiring_docs');
  }

  for (const item of global) {
    if (out.length >= num(options.limit, 6)) break;
    pushUnique(out, item);
  }

  return out.slice(0, num(options.limit, 6));
}
