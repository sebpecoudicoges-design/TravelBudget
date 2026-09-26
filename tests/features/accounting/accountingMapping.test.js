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
  for (const category of ['Caution','Remboursement','Vente','Emprunt','Inconnu']) expect(inferAccount({ type:'expense', category }).origin).toBe('review');
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
