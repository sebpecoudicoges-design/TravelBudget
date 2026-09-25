import { it, expect } from 'vitest';
import { completeInitialMapping, inferAccount, resolveAccount, mappingKey, categoryKey } from '../../../src/features/accounting/accountingMapping.js';

it.each([
  ['expense', 'Repas', 'Déjeuner', '601'], ['expense', 'Logement', 'Hôtel', '602'],
  ['expense', 'Transport Internationale', 'Vol', '603'], ['expense', 'Santé', 'Pharmacie', '604'],
  ['expense', 'Sorties', 'Cinéma', '605'], ['expense', 'Abonnement/Mobile', 'SIM', '607'],
  ['expense', 'Frais bancaire', 'Frais carte', '608'], ['expense', 'Visa', 'Extension visa', '609'],
  ['expense', 'Projet Personnel', 'Formation', '610'], ['expense', 'Cadeau', 'Famille', '611'],
  ['expense', 'Santé', 'Assurance santé', '612'], ['income', 'Revenu', 'Salaire', '701'],
  ['income', 'Revenu', 'Dividendes', '702'], ['expense', 'Autre', 'Bus local', '603'],
])('infers %s %s / %s as %s', (type, category, subcategory, account) => {
  expect(inferAccount({ type, category, subcategory })).toMatchObject({ account, origin: 'automatic' });
});
it('flags ambiguous amounts without automatically removing them from the result', () => {
  for (const category of ['Caution', 'Remboursement', 'Vente', 'Inconnu']) expect(inferAccount({ type: 'expense', category })).toMatchObject({ account: '606', origin: 'review' });
});
it('preserves parent overrides, supports precise subcategory overrides and explicit auto restoration', () => {
  const tx = { type: 'expense', category: 'Santé', subcategory: 'Assurance santé' };
  const settings = { mapping: { [categoryKey(tx)]: '604' } };
  expect(resolveAccount(tx, settings)).toMatchObject({ account: '604', origin: 'manual' });
  settings.mapping[mappingKey(tx)] = '606';
  expect(resolveAccount(tx, settings).account).toBe('606');
  settings.mapping[mappingKey(tx)] = 'auto';
  expect(resolveAccount(tx, settings)).toMatchObject({ account: '612', origin: 'automatic' });
  expect(resolveAccount({ ...tx, subcategory: 'Pharmacie' }, settings).account).toBe('604');
});

it.each([['Alimentation', 'Restaurant', '601'], ['Maison', 'Électricité', '616'], ['Divers', 'Impôts', '614'], ['Transport', 'Réparation', '615'], ['Achats', 'Vêtements', '613'], ['Divers', 'Carburant', '603']])('recognizes %s / %s', (category, subcategory, account) => {
  expect(inferAccount({ type: 'expense', category, subcategory }).account).toBe(account);
});
it('completes classification only once and preserves exact, inherited and explicit auto choices', () => {
  const a = { type: 'expense', category: 'Santé', subcategory: 'Pharmacie' }, b = { type: 'expense', category: 'Maison', subcategory: 'Électricité' }, c = { type: 'expense', category: 'Repas' }, d = { type: 'expense', category: 'Inconnu' };
  const settings = { mapping: { [categoryKey(a)]: '606', [mappingKey(c)]: 'auto' }, balances: { EUR: { debt: 12 } } };
  const result = completeInitialMapping([a, b, c, d], settings);
  expect(result.mapping).toEqual({ ...settings.mapping, [mappingKey(b)]: '616' });
  expect(resolveAccount(b, result)).toMatchObject({ account: '616', origin: 'initial' });
  expect(result.balances).toEqual(settings.balances);
  expect(completeInitialMapping([{ type: 'income', category: 'Salaire' }], result)).toBe(result);
  expect(settings.mapping[mappingKey(b)]).toBeUndefined();
});
