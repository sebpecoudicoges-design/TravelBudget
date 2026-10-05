import { internalAccounting } from './accountingRecognition.js';
import { CHART, accountInfo, selectableAccounts } from './accountingChart.js';
export { ACCOUNTS } from './accountingChart.js';
export const categoryKey = tx => JSON.stringify([tx.type, tx.category || 'Sans catégorie']);
export const mappingKey = tx => JSON.stringify([tx.type, tx.category || 'Sans catégorie', tx.subcategory || '']);
export const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const legacy = { '601':'625710', '602':'613230', '603':'625190', '604':'622610', '605':'651130', '606':'658900', '607':'626190', '608':'627110', '609':'635130', '610':'618190', '611':'651150', '612':'616190', '613':'606340', '614':'635190', '615':'615590', '616':'606110', '701':'758110', '702':'762100', '708':'758900', '471':'471000' };
const matches = (text, kind) => CHART.filter(a => a.kind === kind && a.keywords).flatMap(a => a.keywords.split(',').filter(k => (` ${text} `).includes(` ${k} `)).map(k => ({ a, score: k.length }))).sort((a, b) => b.score - a.score || a.a.code.localeCompare(b.a.code))[0]?.a;
// Parent context disambiguates the configured catalogue without changing category names.
const contextual = {
  'course': { '': '606310', eau: '606310', marche: '606310', snacks: '606310', 'produits maison': '606320' },
  'repas': { eau: '625720' },
  'abonnement mobile': { 'abonnement app': '618120' },
  'projet personnel': { abonnement: '618120', materiel: '606350' },
  'transport': { 'location velo': '613510' },
  'transport internationale': { '': '625190', 'visa run deplacement': '625190' },
  'souvenir': { vetement: '651140' }
};
export function inferAccount(tx) {
  if (internalAccounting(tx)) return { account: '512100', origin: 'automatic', reason: 'Virement interne : trésorerie, hors résultat' };
  const texts = [normal(tx.subcategory), normal(tx.category)], combined = texts.join(' ');
  const [sub, category] = texts;
  const result = (account, origin = 'automatic', reason = accountInfo(account).label) => ({ account, origin, reason });
  if (category === 'mouvement interne') return result('512100');
  if (category === 'ajustement wallet') return result('471000', 'review', 'Ajustement de solde : contrepartie à identifier, hors résultat');
  if (category === 'caution') return result('275000', tx.type === 'expense' ? 'automatic' : 'review', 'Dépôt de garantie ; une entrée doit être rapprochée du dépôt remboursé ou de la caution reçue');
  if (['immo', 'immobilisation'].includes(category)) return result(sub === 'voiture' ? '218200' : '218800', tx.type === 'expense' ? 'automatic' : 'review', 'Immobilisation : rapprocher du bien du Patrimoine');
  if (tx.type === 'expense' && contextual[category]?.[sub]) return result(contextual[category][sub]);
  if (category === 'frais bancaire' && sub === 'retrait atm') return result('627130', 'review', 'Frais ATM uniquement ; le montant retiré relève de la trésorerie');
  const refund = tx.type === 'income' && /\b(remboursement|remboursements|refund|avoir)\b/.test(combined);
  // Capital operations cannot be recognized as income/expense merely from their wording.
  const ambiguous = /\b(caution|emprunt|pret|capital|vente|retrait|virement|transfert)\b/.test(combined);
  for (const [i, text] of texts.entries()) {
    const hit = matches(text, refund ? 'expense' : tx.type);
    if (hit && (!ambiguous || ['661100', '661600', '627130'].includes(hit.code))) return { account: hit.code, origin: 'automatic', reason: `${refund ? 'Remboursement en diminution de charge' : hit.label} · ${i === 0 ? 'sous-catégorie' : 'catégorie'}` };
  }
  return { account: tx.type === 'income' ? '758900' : '658900', origin: 'review', reason: ambiguous || refund ? 'Capital, cession ou remboursement : rapprochement nécessaire' : 'Libellé insuffisant : affectation à confirmer' };
}
export function resolveAccount(tx, settings = {}) {
  const key = mappingKey(tx), exact = settings.mapping?.[key], parent = settings.mapping?.[categoryKey(tx)];
  const code = exact === 'auto' ? null : exact || parent;
  if ((internalAccounting(tx) || normal(tx.category) === 'mouvement interne') && (!code || settings.inferredMapping?.[key] === code)) return { account: walletAccount(tx.walletId || tx.wallet_id, settings), origin: 'automatic', reason: 'Compte bancaire du mouvement interne, hors résultat' };
  if (selectableAccounts().some(a => a.code === code) || Object.values(settings.walletAccounts || {}).includes(code)) return { account: code, origin: settings.inferredMapping?.[key] === code ? (inferAccount(tx).origin === 'review' ? 'review' : 'initial') : 'manual', reason: settings.inferredMapping?.[key] === code ? 'Reclassement détaillé enregistré ; modifiable' : 'Affectation manuelle détaillée' };
  if (code === '471') return { account: '471000', origin: 'manual', reason: 'Ancienne affectation patrimoniale conservée' };
  if (internalAccounting(tx)) return { account: walletAccount(tx.walletId || tx.wallet_id, settings), origin: 'automatic', reason: 'Compte bancaire du mouvement interne, hors résultat' };
  const inferred = inferAccount(tx);
  if (code && legacy[code] && inferred.origin === 'review') return { account: legacy[code], origin: 'review', reason: 'Ancien regroupement repris : sous-compte à confirmer' };
  return inferred;
}
export const mappedAccount = (tx, settings = {}) => resolveAccount(tx, settings).account;
export function completeInitialMapping(transactions, settings = {}) {
  if (settings.classificationVersion === 3) return settings;
  const mapping = { ...settings.mapping }, inferredMapping = { ...settings.inferredMapping };
  for (const tx of transactions.filter(t => ['income', 'expense'].includes(t.type))) {
    const key = mappingKey(tx), existing = mapping[key];
    const valid = code => accountInfo(code) || code === '471' || Object.values(settings.walletAccounts || {}).includes(code);
    const inferred = existing && settings.inferredMapping?.[key] === existing;
    if (existing === 'auto' || (valid(existing) && !inferred) || (!existing && valid(mapping[categoryKey(tx)]))) continue;
    const resolved = inferred ? inferAccount(tx) : resolveAccount(tx, settings);
    mapping[key] = resolved.account;
    // Uncertain accounts retain their review state through a dedicated list.
    inferredMapping[key] = resolved.account;
  }
  return { ...settings, mapping, inferredMapping, classificationVersion: 3, mappingBeforeDetailedChart: settings.mappingBeforeDetailedChart || { ...settings.mapping } };
}
export function assetAccount(asset) {
  const name = normal(asset.name);
  if (asset.asset_type === 'car') return '218200';
  if (asset.asset_type === 'real_estate') return '213000';
  if (/ordinateur|computer|laptop/.test(name)) return '218310';
  if (/telephone|phone|tablette/.test(name)) return '218320';
  if (/photo|camera|video/.test(name)) return '218330';
  if (/mobilier|meuble/.test(name)) return '218400';
  return '218800';
}

export const walletAccount = (id, settings = {}) => settings.walletAccounts?.[id] || '512100';
export function assignWalletAccounts(wallets, settings = {}) {
  const walletAccounts = { ...settings.walletAccounts }, used = new Set([...CHART.map(a => a.code), ...Object.values(walletAccounts)]);
  let changed = false, index = 1;
  for (const w of [...wallets].sort((a,b) => String(a.id).localeCompare(String(b.id)))) {
    if (walletAccounts[w.id]) continue;
    while (used.has(`512${String(index).padStart(3,'0')}`)) index++;
    if (index > 999) break;
    const code = `512${String(index).padStart(3,'0')}`;
    walletAccounts[w.id] = code; used.add(code); changed = true;
  }
  return changed ? { ...settings, walletAccounts } : settings;
}
