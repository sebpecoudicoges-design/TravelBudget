// Personal management statements, not a statutory or closed general ledger.
export const ACCOUNTS = Object.freeze({
  '601': 'Vie quotidienne', '602': 'Logement', '603': 'Déplacements',
  '604': 'Santé', '605': 'Loisirs', '606': 'Autres charges',
  '681': 'Amortissements', '701': 'Revenus d’activité',
  '702': 'Revenus du patrimoine', '708': 'Autres revenus',
  '471': 'Patrimoine / à rapprocher',
});
export const money = value => Number.isFinite(value) ? (value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Non disponible';
const cents = value => Math.round(Number(value) * 100);
const round = value => Math.round(value * 100) / 100;
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const field = (row, camel, snake) => row[camel] ?? row[snake];
const currencyOf = row => String(row.currency || '').toUpperCase();
const inScope = (row, travelId) => !field(row, 'travelId', 'travel_id') || String(field(row, 'travelId', 'travel_id')) === String(travelId);
export const categoryKey = tx => JSON.stringify([tx.type, tx.category || 'Sans catégorie']);
export function mappedAccount(tx, settings = {}) {
  const code = settings.mapping?.[categoryKey(tx)];
  return code === '471' || (ACCOUNTS[code] && code !== '681' && code.startsWith(tx.type === 'income' ? '7' : '6')) ? code : tx.type === 'income' ? '708' : '606';
}
const unique = rows => [...new Map(rows.filter(r => r?.id).map(r => [String(r.id), r])).values()];

// Rounding cumulative depreciation, then taking differences, preserves every cent.
// One instalment at each month-end, starting in the purchase month.
export function depreciationSchedule(asset, share = 1) {
  const start = String(asset.purchase_date || '').slice(0, 10);
  const months = Number(asset.depreciation_months);
  const purchase = Number(asset.purchase_value);
  const residual = Number(asset.residual_value ?? 0);
  if (!validDate(start) || !Number.isInteger(months) || months < 1 || months > 1200 || !Number.isFinite(purchase) || purchase < 0 || !Number.isFinite(residual) || residual < 0 || residual > purchase) return null;
  const base = cents((purchase - residual) * share);
  let previous = 0;
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) + i, 0)).toISOString().slice(0, 10);
    const cumulative = Math.round(base * (i + 1) / months);
    const amount = (cumulative - previous) / 100;
    previous = cumulative;
    return { date, amount, cumulative: cumulative / 100 };
  });
}

export function buildAccountingReport(data, { start, end, currency, travelId, today, settings = {} }) {
  if (!validDate(start) || !validDate(end) || start > end || !validDate(today)) throw new Error('Période invalide.');
  const entries = [], excluded = [], warnings = new Set();
  const transactions = unique(data.transactions || []).filter(t => inScope(t, travelId));
  const assets = unique(data.assets || []).filter(a => inScope(a, travelId));
  const links = data.links || [];
  const selected = row => currencyOf(row) === currency;
  const addExcluded = (tx, reason) => excluded.push({ id: `tx:${tx.id}`, sourceId: tx.id, sourceType: 'transaction', label: tx.label || tx.category || 'Transaction', date: String(tx.dateStart ?? tx.date_start ?? '').slice(0, 10), amount: Number(tx.amount), currency: currencyOf(tx), reason });
  for (const tx of transactions) {
    const date = String(tx.dateStart ?? tx.date_start ?? '').slice(0, 10);
    if (!validDate(date)) { warnings.add('Des transactions sans date valide sont écartées.'); continue; }
    if (date < start || date > end || !selected(tx)) continue;
    const amount = Number(tx.amount);
    const txLinks = links.filter(l => String(l.transaction_id) === String(tx.id));
    const tripShare = (field(tx, 'tripShareLinkId', 'trip_share_link_id') || (field(tx, 'isInternal', 'is_internal') && /^\[trip\] /i.test(tx.label || '')))
      && field(tx, 'affectsBudget', 'affects_budget') !== false && field(tx, 'outOfBudget', 'out_of_budget') !== true;
    let reason = '';
    if (!Number.isFinite(amount) || amount <= 0) reason = 'Montant invalide';
    else if (date > today || (field(tx, 'payNow', 'pay_now') === false && !tripShare) || field(tx, 'recurringInstanceStatus', 'recurring_instance_status') === 'skipped') reason = 'Opération future ou non réglée';
    else if (tx.virtualBudgetOnly) reason = 'Simulation budgétaire';
    else if (field(tx, 'internalTransferId', 'internal_transfer_id')) reason = 'Virement interne : neutre sur le résultat';
    else if (field(tx, 'tripExpenseId', 'trip_expense_id') && (field(tx, 'outOfBudget', 'out_of_budget') === true || field(tx, 'affectsBudget', 'affects_budget') === false)) reason = 'Décaissement Trip brut : seule la quote-part entre au résultat';
    else if (txLinks.some(l => l.relation_type === 'purchase')) reason = 'Achat immobilisé : charge répartie par amortissement';
    else if (txLinks.some(l => ['sale', 'financing', 'extra_cost'].includes(l.relation_type))) { reason = 'Opération patrimoniale à rapprocher'; warnings.add('Cessions, financements ou coûts annexes à rapprocher : résultat provisoire.'); }
    else if (/^ajustement wallet$/i.test(tx.category || '')) reason = 'Ajustement de solde : neutre sur le résultat';
    else if (field(tx, 'isInternal', 'is_internal') && !tripShare) reason = 'Mouvement interne';
    else if (!['income', 'expense'].includes(tx.type)) reason = 'Type non pris en charge';
    else if (mappedAccount(tx, settings) === '471') { reason = 'Affectation patrimoniale manuelle, à rapprocher'; warnings.add('Des affectations patrimoniales restent à rapprocher.'); }
    if (reason) { addExcluded(tx, reason); continue; }
    entries.push({ id: `tx:${tx.id}`, sourceId: tx.id, sourceType: 'transaction', date, amount: round(amount), kind: tx.type, account: mappedAccount(tx, settings), category: tx.category || 'Sans catégorie', label: tx.label || tx.category || 'Transaction', explanation: field(tx, 'tripShareLinkId', 'trip_share_link_id') || /^\[trip\] /i.test(tx.label || '') ? 'Quote-part personnelle Trip ; le décaissement brut est exclu.' : 'Opération réglée, retenue à sa date de trésorerie.' });
  }
  const assetRows = [];
  for (const asset of assets.filter(selected)) {
    const owners = (data.owners || []).filter(o => String(o.asset_id) === String(asset.id));
    const mine = owners.filter(o => o.is_me === true || /^(toi|moi|you|me)$/i.test(String(o.display_name || '').trim()));
    const share = owners.length ? (mine.length === 1 ? Number(mine[0].ownership_percent) / 100 : NaN) : 1;
    if (!Number.isFinite(share) || share < 0 || share > 1) { warnings.add('Quote-part de propriété non identifiée : certains biens sont exclus.'); continue; }
    const schedule = depreciationSchedule(asset, share);
    if (!schedule) { warnings.add('Certains biens ont des paramètres d’amortissement incomplets et sont exclus.'); continue; }
    if (['sold', 'archived'].includes(asset.status)) { warnings.add('Biens vendus ou archivés exclus : leur historique de sortie reste à rapprocher.'); continue; }
    if (asset.purchase_date > today) continue;
    const gross = round(Number(asset.purchase_value) * share);
    const accumulated = schedule.filter(r => r.date <= today).at(-1)?.cumulative || 0;
    assetRows.push({ id: `asset:${asset.id}`, sourceType: 'asset', sourceId: asset.id, label: asset.name || 'Bien', gross, accumulated, amount: round(gross - accumulated), share, date: today, explanation: 'Valeur d’acquisition à ta quote-part − amortissements cumulés. Linéaire en fin de mois dès le mois d’achat ; valeur résiduelle conservée.' });
    for (const row of schedule.filter(r => r.date >= start && r.date <= end && r.date <= today && r.amount > 0)) entries.push({ ...row, id: `depreciation:${asset.id}:${row.date}`, sourceType: 'asset', sourceId: asset.id, kind: 'expense', account: '681', category: 'Amortissements', label: asset.name || 'Bien', explanation: 'Dotation linéaire de fin de mois, selon la durée et la quote-part de propriété. Sans mouvement de trésorerie.' });
    if (!links.some(l => String(l.asset_id) === String(asset.id) && l.relation_type === 'purchase')) warnings.add('Certains biens n’ont pas de transaction d’achat liée : vérifier les doubles charges dans Patrimoine.');
  }
  if (data.partial) warnings.add('Données hors ligne ou incomplètes : vérifier les chiffres après actualisation.');
  const wallets = unique(data.wallets || []).filter(w => inScope(w, travelId) && selected(w));
  const walletRows = wallets.map(w => {
    const balance = (data.walletBalances || []).find(b => String(b.walletId ?? b.wallet_id) === String(w.id));
    const raw = balance?.effectiveBalance ?? balance?.effective_balance;
    const amount = raw == null ? null : Number(raw);
    if (amount === null || !Number.isFinite(amount)) warnings.add('Certains soldes de comptes ne sont pas disponibles.');
    return { id: `wallet:${w.id}`, sourceId: w.id, sourceType: 'wallet', label: w.name || 'Compte', date: today, amount: Number.isFinite(amount) ? round(amount) : null, explanation: 'Solde courant calculé par TravelBudget depuis le solde de référence et les mouvements réglés. Inclut les comptes archivés encore porteurs d’un solde.' };
  });
  const sum = (rows, key = 'amount') => rows.reduce((total, row) => total + cents(row[key]), 0) / 100;
  const income = sum(entries.filter(e => e.kind === 'income'));
  const expenses = sum(entries.filter(e => e.kind === 'expense'));
  const depreciation = sum(entries.filter(e => e.account === '681'));
  const cash = walletRows.length && walletRows.every(w => w.amount !== null) ? sum(walletRows) : null;
  const declared = settings.balances?.[currency] || {};
  const declaredValue = key => declared.asOf === today && declared[key] !== '' && declared[key] != null && Number.isFinite(Number(declared[key])) && Number(declared[key]) >= 0 ? round(Number(declared[key])) : null;
  const debt = declaredValue('debt'), receivable = declaredValue('receivable');
  const netAssets = sum(assetRows);
  const netWorth = cash !== null && debt !== null && receivable !== null ? round(cash + netAssets + receivable - debt) : null;
  const result = round(income - expenses);
  return { entries: entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), excluded, assetRows, walletRows, warnings: [...warnings], income, expenses, depreciation, result, cash, debt, receivable, netAssets, netWorth, savingRate: income > 0 ? round((income - (expenses - depreciation)) / income * 100) : null, currency, start, end, today };
}
