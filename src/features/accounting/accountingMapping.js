// Personal management accounts, deliberately separate from a statutory chart.
export const ACCOUNTS = Object.freeze({
  '601': 'Vie quotidienne', '602': 'Logement', '603': 'Déplacements',
  '604': 'Santé', '605': 'Loisirs', '606': 'Autres charges',
  '607': 'Télécoms et abonnements', '608': 'Frais bancaires', '609': 'Démarches et visas',
  '610': 'Formation et projets', '611': 'Cadeaux et dons', '612': 'Assurances',
  '613': 'Habillement et équipement personnel', '614': 'Impôts et taxes',
  '615': 'Entretien et réparations', '616': 'Énergie et charges du logement',
  '681': 'Amortissements', '701': 'Revenus d’activité', '702': 'Revenus du patrimoine',
  '708': 'Autres revenus', '471': 'Patrimoine / à rapprocher',
});
export const categoryKey = tx => JSON.stringify([tx.type, tx.category || 'Sans catégorie']);
export const mappingKey = tx => JSON.stringify([tx.type, tx.category || 'Sans catégorie', tx.subcategory || '']);
const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const allowed = (code, type) => typeof code === 'string' && (code === '471' || (ACCOUNTS[code] && code !== '681' && code.startsWith(type === 'income' ? '7' : '6')));
const expenseRules = [
  ['614', /\b(impots?|taxes?|fiscalite|income tax)\b/, 'Impôt ou taxe'],
  ['616', /\b(electricite|electricity|gaz|gas bill|charges locatives|facture eau)\b/, 'Charge du logement'],
  ['615', /\b(reparations?|entretien|maintenance|garage|mecanique|pneus?)\b/, 'Entretien ou réparation'],
  ['613', /\b(vetements?|chaussures?|habillement|clothing|shoes|equipement personnel)\b/, 'Habillement ou équipement personnel'],
  ['612', /\b(assurances?|insurance)\b/, 'Assurance identifiée'],
  ['608', /\b(frais bancaires?|frais carte|commissions? change|tenue de compte|bank fee)\b/, 'Frais de compte ou de change'],
  ['607', /\b(abonnements?|telephone|mobile|telecom|internet|sim|recharge data|subscription)\b/, 'Télécom ou abonnement'],
  ['604', /\b(sante|pharmacie|medicaments?|dentiste|consultations?|soins|health|medical)\b/, 'Dépense de santé'],
  ['609', /\b(visa|consulaire|demarches|frontiere)\b/, 'Formalité ou visa'],
  ['602', /\b(logement|hebergement|loyers?|auberges?|hotels?|guesthouse|airbnb|camping|rent|accommodation)\b/, 'Hébergement ou loyer'],
  ['603', /\b(transports?|carburant|avion|billet avion|location voiture|bus|train|metro|taxi|vtc|scooter|essence|ferry|velo|parking|peage|vol|flight|fuel)\b/, 'Déplacement ou transport'],
  ['610', /\b(etudes|scolarite|formations?|projet personnel|logiciel|course education|training)\b/, 'Formation ou projet personnel'],
  ['611', /\b(cadeaux?|dons?|gift|donation)\b/, 'Cadeau ou don'],
  ['605', /\b(bar|bars|activites?|excursions?|sport|sortie|sorties|loisir|loisirs|culturel|sportive|fete|cinema|musee|souvenir|souvenirs|evenement)\b/, 'Loisir ou sortie'],
  ['601', /\b(alimentation|nourriture|boulangerie|restaurants?|repas|course|courses|supermarche|marche|petit dejeuner|dejeuner|diner|snack|cafe|eau|laundry|hygiene|food|groceries)\b/, 'Vie quotidienne'],
];
export function inferAccount(tx) {
  const category = normal(tx.category), subcategory = normal(tx.subcategory);
  if (/\b(caution|emprunt|pret|remboursement|vente|materiel|retrait atm|mouvement interne|virement|transfert|change devise)\b/.test(`${category} ${subcategory}`)) {
    return { account: tx.type === 'income' ? '708' : '606', origin: 'review', reason: 'Nature ambiguë : remboursement, capital ou charge à confirmer' };
  }
  for (const [level, text] of [['sous-catégorie', subcategory], ['catégorie', category]]) {
    if (!text) continue;
    if (tx.type === 'income') {
      if (/\b(salaires?|primes?|bonus|paye|remuneration|honoraires|freelance|salary|wage|travail)\b/.test(text)) return { account: '701', origin: 'automatic', reason: `Revenu d’activité reconnu dans la ${level}` };
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
  if (allowed(exact, tx.type) && settings.inferredMapping?.[mappingKey(tx)] === exact) return { account: exact, origin: 'initial', reason: 'Déduction initiale enregistrée une seule fois ; modifiable' };
  if (allowed(exact, tx.type)) return { account: exact, origin: 'manual', reason: 'Affectation manuelle de cette catégorie / sous-catégorie' };
  const parent = settings.mapping?.[categoryKey(tx)];
  if (allowed(parent, tx.type)) return { account: parent, origin: 'manual', reason: 'Affectation manuelle de la catégorie conservée' };
  return inferAccount(tx);
}
export const mappedAccount = (tx, settings = {}) => resolveAccount(tx, settings).account;

// Freeze a first pass once per local user/travel scope; never overwrite a user's mapping.
export function completeInitialMapping(transactions, settings = {}) {
  if (settings.classificationVersion === 1) return settings;
  const mapping = { ...settings.mapping }, inferredMapping = { ...settings.inferredMapping };
  for (const tx of transactions.filter(t => ['income', 'expense'].includes(t.type))) {
    const key = mappingKey(tx), resolved = resolveAccount(tx, settings);
    if (resolved.origin !== 'automatic' || Object.hasOwn(mapping, key)) continue;
    mapping[key] = resolved.account;
    inferredMapping[key] = resolved.account;
  }
  return { ...settings, mapping, inferredMapping, classificationVersion: 1 };
}
