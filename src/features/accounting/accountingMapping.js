// Personal management accounts, deliberately separate from a statutory chart.
export const ACCOUNTS = Object.freeze({
  '601': 'Vie quotidienne', '602': 'Logement', '603': 'Déplacements',
  '604': 'Santé', '605': 'Loisirs', '606': 'Autres charges',
  '607': 'Télécoms et abonnements', '608': 'Frais bancaires', '609': 'Démarches et visas',
  '610': 'Formation et projets', '611': 'Cadeaux et dons', '612': 'Assurances',
  '681': 'Amortissements', '701': 'Revenus d’activité', '702': 'Revenus du patrimoine',
  '708': 'Autres revenus', '471': 'Patrimoine / à rapprocher',
});
export const categoryKey = tx => JSON.stringify([tx.type, tx.category || 'Sans catégorie']);
export const mappingKey = tx => JSON.stringify([tx.type, tx.category || 'Sans catégorie', tx.subcategory || '']);
const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const allowed = (code, type) => typeof code === 'string' && (code === '471' || (ACCOUNTS[code] && code !== '681' && code.startsWith(type === 'income' ? '7' : '6')));
const expenseRules = [
  ['612', /\b(assurance|insurance)\b/, 'Assurance identifiée'],
  ['608', /\b(frais bancaire|frais carte|commission change|tenue de compte|bank fee)\b/, 'Frais de compte ou de change'],
  ['607', /\b(abonnement|mobile|telecom|internet|sim|recharge data|subscription)\b/, 'Télécom ou abonnement'],
  ['604', /\b(sante|pharmacie|consultation|soins|health|medical)\b/, 'Dépense de santé'],
  ['609', /\b(visa|consulaire|demarches|frontiere)\b/, 'Formalité ou visa'],
  ['602', /\b(logement|loyer|auberge|hotel|guesthouse|airbnb|camping|rent|accommodation)\b/, 'Hébergement ou loyer'],
  ['603', /\b(transport|bus|train|metro|taxi|vtc|scooter|essence|ferry|velo|parking|peage|vol|flight|fuel)\b/, 'Déplacement ou transport'],
  ['610', /\b(formation|projet personnel|logiciel|course education|training)\b/, 'Formation ou projet personnel'],
  ['611', /\b(cadeau|don|gift|donation)\b/, 'Cadeau ou don'],
  ['605', /\b(sortie|sorties|loisir|loisirs|culturel|sportive|fete|cinema|musee|souvenir|souvenirs|evenement)\b/, 'Loisir ou sortie'],
  ['601', /\b(repas|course|courses|supermarche|marche|petit dejeuner|dejeuner|diner|snack|cafe|eau|laundry|hygiene|food|groceries)\b/, 'Vie quotidienne'],
];
export function inferAccount(tx) {
  const category = normal(tx.category), subcategory = normal(tx.subcategory);
  if (/\b(caution|emprunt|pret|remboursement|vente|materiel|retrait atm|mouvement interne|virement|transfert|change devise)\b/.test(`${category} ${subcategory}`)) {
    return { account: tx.type === 'income' ? '708' : '606', origin: 'review', reason: 'Nature ambiguë : remboursement, capital ou charge à confirmer' };
  }
  for (const [level, text] of [['sous-catégorie', subcategory], ['catégorie', category]]) {
    if (!text) continue;
    if (tx.type === 'income') {
      if (/\b(salaire|prime|honoraires|freelance|salary|wage|travail)\b/.test(text)) return { account: '701', origin: 'automatic', reason: `Revenu d’activité reconnu dans la ${level}` };
      if (/\b(dividende|dividendes|interet|interets|revenu locatif|loyer percu|rente)\b/.test(text)) return { account: '702', origin: 'automatic', reason: `Revenu du patrimoine reconnu dans la ${level}` };
    } else {
      const rule = expenseRules.find(([, pattern]) => pattern.test(text));
      if (rule) return { account: rule[0], origin: 'automatic', reason: `${rule[2]} · ${level}` };
    }
  }
  return { account: tx.type === 'income' ? '708' : '606', origin: 'review', reason: 'Aucune règle suffisamment précise : à vérifier' };
}
export function resolveAccount(tx, settings = {}) {
  const exact = settings.mapping?.[mappingKey(tx)];
  // An explicit auto selection overrides an older category-wide setting.
  if (exact === 'auto') return inferAccount(tx);
  if (allowed(exact, tx.type)) return { account: exact, origin: 'manual', reason: 'Affectation manuelle de cette catégorie / sous-catégorie' };
  const parent = settings.mapping?.[categoryKey(tx)];
  if (allowed(parent, tx.type)) return { account: parent, origin: 'manual', reason: 'Affectation manuelle de la catégorie conservée' };
  return inferAccount(tx);
}
export const mappedAccount = (tx, settings = {}) => resolveAccount(tx, settings).account;
