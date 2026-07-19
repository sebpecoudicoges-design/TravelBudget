import { describe, expect, it } from 'vitest';
import {
  inferWalletTypeFromName,
  validateWalletCreateInput,
  validateWalletEditInput,
  walletTypeLabel,
} from '../../../src/features/dashboard/dashboardWalletRules.js';

describe('dashboard wallet rules', () => {
  it('infers common wallet types from names', () => {
    expect(inferWalletTypeFromName('Banque Australie')).toBe('bank');
    expect(inferWalletTypeFromName('Cash poche')).toBe('cash');
    expect(inferWalletTypeFromName('Visa voyage')).toBe('card');
    expect(inferWalletTypeFromName('Livret epargne')).toBe('savings');
    expect(inferWalletTypeFromName('Divers')).toBe('other');
  });

  it('validates wallet creation input with normalized values', () => {
    expect(validateWalletCreateInput({
      name: ' Banque AU ',
      currency: ' aud ',
      type: 'Bank',
      balance: '12,50',
    })).toEqual({
      ok: true,
      value: { name: 'Banque AU', currency: 'AUD', type: 'bank', balance: 12.5 },
    });

    expect(validateWalletCreateInput({ name: '', currency: 'AUD', type: 'bank', balance: '0' }))
      .toMatchObject({ ok: false, error: 'Nom requis.' });
    expect(validateWalletCreateInput({ name: 'X', currency: 'A$', type: 'bank', balance: '0' }))
      .toMatchObject({ ok: false, error: 'Devise invalide (ex: EUR, THB).' });
    expect(validateWalletCreateInput({ name: 'X', currency: 'AUD', type: 'crypto', balance: '0' }))
      .toMatchObject({ ok: false, error: 'Type invalide.' });
    expect(validateWalletCreateInput({ name: 'X', currency: 'AUD', type: 'bank', balance: 'abc' }))
      .toMatchObject({ ok: false, error: 'Solde invalide.' });
  });

  it('validates wallet edit input and labels types', () => {
    expect(validateWalletEditInput({ name: ' Revolut ', type: 'bank' }))
      .toEqual({ ok: true, value: { name: 'Revolut', type: 'bank' } });
    expect(validateWalletEditInput({ name: 'Revolut', type: 'bad' }))
      .toMatchObject({ ok: false, error: 'Type invalide.' });
    expect(walletTypeLabel('cash')).toBe('Cash (espèces)');
    expect(walletTypeLabel('unknown')).toBe('Autre');
  });
});
