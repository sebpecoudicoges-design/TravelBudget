import { it, expect } from 'vitest';
import { CHART } from '../../../src/features/accounting/accountingChart.js';
import { inferAccount, resolveAccount, completeInitialMapping, mappingKey, categoryKey } from '../../../src/features/accounting/accountingMapping.js';
it('provides over one hundred unique six-digit accounts across balance and result classes', () => {
  expect(CHART.length).toBeGreaterThan(100);
  expect(new Set(CHART.map(a => a.code)).size).toBe(CHART.length);
  expect(CHART.every(a => /^\d{6}$/.test(a.code))).toBe(true);
  expect(new Set(CHART.map(a => a.kind))).toEqual(new Set(['equity','liability','asset','contraAsset','suspense','expense','income']));
});
it.each([
  ['expense','Repas','Déjeuner','625710'], ['expense','Logement','Hôtel','613220'],
  ['expense','Transport Internationale','Vol','625110'], ['expense','Santé','Pharmacie','606330'],
  ['expense','Sorties','Cinéma','651110'], ['expense','Abonnement/Mobile','SIM','626110'],
  ['expense','Frais bancaire','Frais carte','627110'], ['expense','Visa','Extension visa','635130'],
  ['expense','Projet Personnel','Formation','618110'], ['expense','Cadeau','Famille','651150'],
  ['expense','Santé','Assurance santé','616130'], ['income','Revenu','Salaire','758110'],
  ['income','Revenu','Dividendes','761100'], ['expense','Autre','Bus local','625130'],
  ['expense','Maison','Électricité','606110'], ['expense','Achats','Vêtements','606340'],
  ['expense','Finances','Intérêts emprunt','661100'], ['income','Remboursement','Pharmacie','606330'],
  ['expense','Banque','Frais retrait','627130'], ['income','Revenus','Loyer perçu','752100']
])('classifies %s %s / %s as %s', (type, category, subcategory, account) => {
  expect(inferAccount({ type, category, subcategory })).toMatchObject({ account, origin:'automatic' });
});
it('does not silently treat capital or unidentified refunds as trading flows', () => {
  for (const category of ['Remboursement','Vente','Emprunt','Inconnu']) expect(inferAccount({ type:'expense', category }).origin).toBe('review');
});
it('migrates coarse accounts once, archives prior choices, preserves detailed manual decisions and auto', () => {
  const a={type:'expense',category:'Santé',subcategory:'Assurance santé'}, b={type:'expense',category:'Repas'}, c={type:'income',category:'Salaire'};
  const settings={classificationVersion:1,mapping:{[mappingKey(a)]:'604',[mappingKey(b)]:'613220',[mappingKey(c)]:'auto'},balances:{EUR:{debt:1}}};
  const next=completeInitialMapping([a,b,c],settings);
  expect(next.mapping[mappingKey(a)]).toBe('616130');
  expect(next.mapping[mappingKey(b)]).toBe('613220');
  expect(next.mapping[mappingKey(c)]).toBe('auto');
  expect(next.mappingBeforeDetailedChart).toEqual(settings.mapping);
  expect(next.balances).toEqual(settings.balances);
  expect(completeInitialMapping([a,b,c],next)).toBe(next);
  expect(resolveAccount(a,next).origin).toBe('initial');
  expect(resolveAccount(b,next).origin).toBe('manual');
  expect(resolveAccount(a,{mapping:{[categoryKey(a)]:'622610'}}).account).toBe('622610');
  const inherited=completeInitialMapping([a],{mapping:{[categoryKey(a)]:'622610'}});
  expect(inherited.mapping[mappingKey(a)]).toBeUndefined();
  expect(resolveAccount(a,inherited).origin).toBe('manual');
  expect(resolveAccount(a,{mapping:{[mappingKey(a)]:'auto',[categoryKey(a)]:'622610'}}).account).toBe('616130');
});
it('retains review flags after migration and old capital exclusions', () => {
  const tx={type:'expense',category:'Inconnu'};
  expect(resolveAccount(tx,completeInitialMapping([tx])).origin).toBe('review');
  expect(resolveAccount(tx,{mapping:{[categoryKey(tx)]:'471'}}).account).toBe('471000');
});

it('assigns stable bank subaccounts and maps internal transactions without result classification', async()=>{
 const {assignWalletAccounts,resolveAccount}=await import('../../../src/features/accounting/accountingMapping.js');
 const first=assignWalletAccounts([{id:'b'},{id:'a'}]);
 const next=assignWalletAccounts([{id:'z'},{id:'b'},{id:'a'}],first);
 expect(next.walletAccounts.a).toBe(first.walletAccounts.a);expect(next.walletAccounts.b).not.toBe(next.walletAccounts.z);
 expect(resolveAccount({type:'expense',category:'Interne',is_internal:true,wallet_id:'b'},next).account).toBe(next.walletAccounts.b);
});

// Real catalogue labels: context must win over a misleading isolated keyword.
it.each([
 ['Course','', '606310'], ['Course','Eau','606310'], ['Course','Marché','606310'],
 ['Course','Snacks','606310'], ['Course','Produits maison','606320'],
 ['Repas','Eau','625720'], ['Abonnement/Mobile','Abonnement app','618120'],
 ['Projet Personnel','Abonnement','618120'], ['Projet Personnel','Matériel','606350'],
 ['Transport','Location vélo','613510'], ['Transport Internationale','','625190'],
 ['Transport Internationale','Visa-run déplacement','625190'], ['Souvenir','Vêtement','651140'],
 ['Caution','Logement','275000'], ['Caution','Location véhicule','275000'],
 ['Immo','Voiture','218200'], ['Immo','Matériel','218800'], ['Immobilisation','','218800'],
 ['Santé','Coiffeur','651170'], ['Revenu','Chomage','758210']
])('matches catalogue %s / %s to %s', (category,subcategory,account)=>{
 expect(inferAccount({type:category==='Revenu'?'income':'expense',category,subcategory})).toMatchObject({account,origin:'automatic'});
});
it('refreshes version 2 inference once without overwriting manual edits, bank codes or exclusions',()=>{
 const a={type:'expense',category:'Course',subcategory:'Eau'};
 const b={type:'expense',category:'Souvenir',subcategory:'Vêtement'};
 const c={type:'expense',category:'Mouvement interne',wallet_id:'bank'};
 const d={type:'expense',category:'Immo'};
 const settings={classificationVersion:2,walletAccounts:{bank:'512001'},mapping:{[mappingKey(a)]:'658900',[mappingKey(b)]:'606340',[mappingKey(c)]:'512001',[mappingKey(d)]:'471'},inferredMapping:{[mappingKey(a)]:'658900',[mappingKey(b)]:'651140'}};
 const next=completeInitialMapping([a,b,c,d],settings);
 expect(next.mapping[mappingKey(a)]).toBe('606310');
 expect(next.mapping[mappingKey(b)]).toBe('606340');
 expect(next.mapping[mappingKey(c)]).toBe('512001');
 expect(next.mapping[mappingKey(d)]).toBe('471');
 expect(completeInitialMapping([a,b,c,d],next)).toBe(next);
 expect(resolveAccount(c,{walletAccounts:settings.walletAccounts}).account).toBe('512001');
});
it('keeps ambiguous bank adjustments, ATM fees, proceeds and deposit receipts reviewable',()=>{
 for(const tx of [
  {type:'income',category:'Caution'}, {type:'income',category:'Immo'},
  {type:'expense',category:'Ajustement wallet'},
  {type:'expense',category:'Frais bancaire',subcategory:'Retrait ATM'},
  {type:'income',category:'Revenu',subcategory:'Vente'},
  {type:'income',category:'Autre',subcategory:'Remboursement'}
 ]) expect(inferAccount(tx).origin).toBe('review');
});
