import { internalAccounting, settledAt } from './accountingRecognition.js';

// Linked cash flows are counted once. Positions are scoped by the existing local settings key.
export function positionLedger(settings, transactions, links, today) {
  const used = new Set((links || []).map(l => String(l.transaction_id)));
  for (const d of settings.debts || []) {
    if (d.originTransactionId) used.add(String(d.originTransactionId));
    for (const r of d.repayments || []) used.add(String(r.transactionId));
  }
  const rows = [], claimed = new Set(), errors = [];
  for (const p of settings.positions || []) {
    let balance = 0, valid = !!p.id && !!String(p.name || '').trim() && /^[A-Z]{3}$/.test(p.currency || '') && ['275000','467100'].includes(p.account), history = [];
    const local = new Set();
    for (const id of p.transactionIds || []) {
      const tx = transactions.find(t => String(t.id) === String(id));
      const eligible = tx && !used.has(String(id)) && !local.has(String(id)) && !internalAccounting(tx) && !tx.trip_expense_id && !tx.tripExpenseId && !tx.virtualBudgetOnly && (tx.recurring_instance_status ?? tx.recurringInstanceStatus) !== 'skipped' && settledAt(tx, today) && String(tx.currency).toUpperCase() === p.currency && ['income','expense'].includes(tx.type) && Number.isFinite(Number(tx.amount)) && Number(tx.amount) > 0;
      if (!eligible) { valid = false; continue; }
      local.add(String(id));
      history.push({ id: `position-tx:${id}`, sourceId: id, sourceType: 'transaction', label: tx.label || tx.category, date: String(tx.cashDate || tx.dateStart || tx.date_start).slice(0,10), amount: (tx.type === 'expense' ? 1 : -1) * Number(tx.amount), currency: p.currency });
    }
    history.sort((a,b) => a.date.localeCompare(b.date) || (b.amount > 0) - (a.amount > 0));
    for (const h of history) { balance = Math.round((balance + h.amount) * 100) / 100; if (balance < 0) valid = false; }
    if (!history.length) valid = false;
    for (const id of local) used.add(id);
    if (valid) for (const id of local) claimed.add(id);
    else errors.push(`Rattachement à vérifier : ${p.name || 'Créance'} (opération absente, déjà utilisée ou remboursement excessif).`);
    rows.push({ ...p, id: `position:${p.id}`, positionId: p.id, sourceId: p.id, sourceType: 'position', label: p.name, date: today, amount: valid ? balance : null, history, valid });
  }
  return { rows, claimed, errors };
}

export function assetRattachements(settings, data, today) {
  const links = [...(data.links || [])], errors = [];
  const occupied = new Set([...(settings.positions || []).flatMap(p => p.transactionIds || []), ...(settings.debts || []).flatMap(d => [d.originTransactionId, ...(d.repayments || []).map(r => r.transactionId)])].filter(Boolean).map(String));
  for (const link of settings.assetLinks || []) {
    const tx = data.transactions.find(t => String(t.id) === String(link.transaction_id));
    const asset = data.assets.find(a => String(a.id) === String(link.asset_id));
    if (!tx || !asset || occupied.has(String(tx.id)) || links.some(l => String(l.transaction_id) === String(tx.id) || String(l.asset_id) === String(asset.id) && l.relation_type === 'purchase') || tx.type !== 'expense' || internalAccounting(tx) || tx.trip_expense_id || tx.tripExpenseId || tx.virtualBudgetOnly || !settledAt(tx,today) || tx.currency !== asset.currency || !Number.isFinite(Number(tx.amount)) || !(Number(tx.amount) > 0) || Math.round(Number(tx.amount)*100) !== Math.round(Number(asset.purchase_value)*100) || asset.purchase_date > today) {
      errors.push('Achat rattaché au patrimoine à vérifier : source modifiée, déjà liée ou montant incompatible.'); continue;
    }
    links.push({ ...link, relation_type: 'purchase' });
  }
  return { links, errors };
}
