// Personal management statements, not a statutory or closed general ledger.
import { mappedAccount, resolveAccount } from './accountingMapping.js';
import { convertAccountingAmount } from './accountingFx.js';
export { ACCOUNTS, categoryKey, mappedAccount } from './accountingMapping.js';
export const money = value => Number.isFinite(value) ? (value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Non disponible';
const cents = value => Math.round(Number(value) * 100);
const round = value => Math.round(value * 100) / 100;
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const field = (row, camel, snake) => row[camel] ?? row[snake];
const currencyOf = row => String(row.currency || '').toUpperCase();
const inScope = (row, travelId) => !field(row, 'travelId', 'travel_id') || String(field(row, 'travelId', 'travel_id')) === String(travelId);
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

export function buildAccountingReport(data, { start, end, currency, travelId, today, settings = {}, mode = 'consolidated' }) {
  if (!validDate(start) || !validDate(end) || start > end || !validDate(today)) throw new Error('Période invalide.');
  const entries = [], excluded = [], warnings = new Set();
  const transactions = unique(data.transactions || []).filter(t => inScope(t, travelId));
  const assets = unique(data.assets || []).filter(a => inScope(a, travelId));
  const links = data.links || [];
  const selected = row => mode !== 'native' || currencyOf(row) === currency;
  const missingFx = new Set();
  const convert = (value, from, at) => {
    const result = convertAccountingAmount(value, from, currency, at, data.fx);
    if (result.amount === null && Number.isFinite(value)) missingFx.add(`${from}/${currency} ${at}`);
    return result;
  };
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
    if (tx.amount == null || String(tx.amount).trim() === '' || !Number.isFinite(amount)) reason = 'Montant invalide';
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
    entries.push({ id: `tx:${tx.id}`, sourceId: tx.id, sourceType: 'transaction', date, ...convert(amount, currencyOf(tx), date), kind: tx.type, ...resolveAccount(tx, settings), category: tx.category || 'Sans catégorie', subcategory: tx.subcategory || '', label: tx.label || tx.category || 'Transaction', explanation: field(tx, 'tripShareLinkId', 'trip_share_link_id') || /^\[trip\] /i.test(tx.label || '') ? 'Quote-part personnelle Trip ; le décaissement brut est exclu.' : 'Opération réglée, retenue à sa date de trésorerie.' });
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
    const assetFx = convert(gross, currencyOf(asset), asset.purchase_date);
    const accumulatedFx = convert(accumulated, currencyOf(asset), asset.purchase_date).amount;
    assetRows.push({ id: `asset:${asset.id}`, sourceType: 'asset', sourceId: asset.id, label: asset.name || 'Bien', ...assetFx, originalAmount: round(gross - accumulated), gross: assetFx.amount, accumulated: accumulatedFx, amount: assetFx.amount === null ? null : round(assetFx.amount - accumulatedFx), share, date: today, explanation: 'Valeur d’acquisition à ta quote-part − amortissements cumulés. Taux historique d’acquisition conservé pour le bien et ses dotations ; valeur résiduelle conservée.' });
    for (const row of schedule.filter(r => r.date >= start && r.date <= end && r.date <= today && r.amount > 0)) {
      const conversion = convert(row.amount, currencyOf(asset), asset.purchase_date);
      const cumulative = convert(row.cumulative, currencyOf(asset), asset.purchase_date).amount;
      const before = convert(round(row.cumulative - row.amount), currencyOf(asset), asset.purchase_date).amount;
      entries.push({ ...row, ...conversion, amount: cumulative === null ? null : round(cumulative - before), id: `depreciation:${asset.id}:${row.date}`, sourceType: 'asset', sourceId: asset.id, kind: 'expense', account: '681', category: 'Amortissements', label: asset.name || 'Bien', explanation: 'Dotation linéaire de fin de mois, à la quote-part de propriété et au taux d’acquisition. Arrondis par différence des cumuls. Sans mouvement de trésorerie.' });
    }
    if (!links.some(l => String(l.asset_id) === String(asset.id) && l.relation_type === 'purchase')) warnings.add('Certains biens n’ont pas de transaction d’achat liée : vérifier les doubles charges dans Patrimoine.');
  }
  if (data.partial) warnings.add('Données hors ligne ou incomplètes : vérifier les chiffres après actualisation.');
  const wallets = unique(data.wallets || []).filter(w => inScope(w, travelId) && selected(w));
  const walletRows = wallets.map(w => {
    const balance = (data.walletBalances || []).find(b => String(b.walletId ?? b.wallet_id) === String(w.id));
    const raw = balance?.effectiveBalance ?? balance?.effective_balance;
    const amount = raw == null ? null : Number(raw);
    if (amount === null || !Number.isFinite(amount)) warnings.add('Certains soldes de comptes ne sont pas disponibles.');
    return { id: `wallet:${w.id}`, sourceId: w.id, sourceType: 'wallet', label: w.name || 'Compte', date: today, ...convert(amount, currencyOf(w), today), explanation: 'Solde courant calculé par TravelBudget depuis le solde de référence et les mouvements réglés. Conversion au taux journalier de la date du bilan. Inclut les comptes archivés encore porteurs d’un solde.' };
  });
  const sum = (rows, key = 'amount') => rows.every(r => Number.isFinite(r[key])) ? rows.reduce((total, row) => total + cents(row[key]), 0) / 100 : null;
  const income = sum(entries.filter(e => e.kind === 'income'));
  const expenses = sum(entries.filter(e => e.kind === 'expense'));
  const depreciation = sum(entries.filter(e => e.account === '681'));
  const cash = walletRows.every(w => w.amount !== null) ? sum(walletRows) : null;
  const declarationCurrencies = mode === 'native' ? [currency] : [...new Set([currency, ...transactions.map(currencyOf), ...assets.map(currencyOf), ...wallets.map(currencyOf), ...Object.keys(settings.balances || {})])].filter(Boolean).sort();
  const unconfirmed = [];
  const declaredValue = (cur, key) => {
    const declared = settings.balances?.[cur] || {};
    const raw = declared[key];
    if (raw === '' || raw == null) { unconfirmed.push(`${cur} ${key === 'debt' ? 'dettes' : 'créances'}`); return 0; }
    if (!Number.isFinite(Number(raw)) || Number(raw) < 0) { warnings.add('Solde complémentaire invalide : corrige le paramétrage.'); return null; }
    if (declared.asOf !== today) unconfirmed.push(`${cur} montant déclaré le ${declared.asOf || 'date inconnue'}`);
    return convert(Number(raw), cur, today).amount;
  };
  const debt = sum(declarationCurrencies.map(cur => ({ amount: declaredValue(cur, 'debt') })));
  const receivable = sum(declarationCurrencies.map(cur => ({ amount: declaredValue(cur, 'receivable') })));
  const netAssets = sum(assetRows);
  const netWorth = [cash, debt, receivable, netAssets].every(Number.isFinite) ? round(cash + netAssets + receivable - debt) : null;
  const availableCash = sum(walletRows.filter(w => w.amount === null || w.amount >= 0));
  const overdraft = sum(walletRows.filter(w => w.amount === null || w.amount < 0).map(w => ({ amount: w.amount === null ? null : -w.amount })));
  const totalAssets = sum([{ amount: availableCash }, { amount: netAssets }, { amount: receivable }]);
  const liabilities = sum([{ amount: overdraft }, { amount: debt }]);
  const totalFunding = sum([{ amount: netWorth }, { amount: liabilities }]);
  const periodDays = Math.floor((Date.parse(end < today ? end : today) - Date.parse(start)) / 86400000) + 1;
  const cashExpenses = expenses !== null && depreciation !== null ? round(expenses - depreciation) : null;
  const monthlyExpenses = cashExpenses !== null && periodDays > 0 ? cashExpenses * 365.25 / (12 * periodDays) : null;
  const autonomyMonths = monthlyExpenses > 0 && cash !== null ? round(Math.max(0, cash) / monthlyExpenses) : null;
  const debtRatio = totalAssets > 0 && liabilities !== null ? round(liabilities / totalAssets * 100) : null;
  if (unconfirmed.length) warnings.add('Bilan provisoire : compléments absents retenus à zéro ; montants déjà saisis conservés. À confirmer dans le paramétrage.');
  const result = income !== null && expenses !== null ? round(income - expenses) : null;
  if (missingFx.size) warnings.add(`${missingFx.size} conversion(s) sans taux FX daté : les totaux concernés sont non disponibles. Ouvre les mouvements pour identifier les sources.`);
  if (data.fx?.errors?.length) warnings.add('Certaines séries FX n’ont pas pu être actualisées ; seuls les taux datés disponibles sont utilisés.');
  const reviewCount = entries.filter(e => e.origin === 'review').length;
  if (reviewCount) warnings.add(`${reviewCount} mouvement(s) à classer ou à confirmer dans le paramétrage.`);
  return { entries: entries.sort((a, b) => a.account.localeCompare(b.account, 'fr', { numeric: true }) || a.category.localeCompare(b.category, 'fr', { numeric: true }) || (a.subcategory || '').localeCompare(b.subcategory || '', 'fr', { numeric: true }) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)), excluded, assetRows, walletRows, warnings: [...warnings], income, expenses, depreciation, result, cash, debt, receivable, netAssets, netWorth, declarationCurrencies, unconfirmed, availableCash, overdraft, totalAssets, liabilities, totalFunding, autonomyMonths, debtRatio, cashExpenses, mode, savingRate: income > 0 && expenses !== null && depreciation !== null ? round((income - (expenses - depreciation)) / income * 100) : null, currency, start, end, today };
}
