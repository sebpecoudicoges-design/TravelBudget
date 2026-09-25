import { it, expect } from 'vitest';
import { inferAccount, resolveAccount, mappingKey, categoryKey } from '../../../src/features/accounting/accountingMapping.js';

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
