import { describe, expect, it } from 'vitest';
import {
  buildWalletArchivePatch,
  buildWalletCreateRow,
  buildWalletEditPatch,
  canDeleteWallet,
  inferWalletTypeFromName,
  normalizeWalletTypeUpdates,
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

  it('builds SQL-safe wallet create and edit payloads', () => {
    expect(buildWalletCreateRow({
      name: 'Cash',
      currency: 'aud',
      type: 'cash',
      balance: '20',
    }, { userId: 'user-1', travelId: 'travel-1', periodId: 'period-1' })).toEqual({
      ok: true,
      value: {
        user_id: 'user-1',
        travel_id: 'travel-1',
        period_id: 'period-1',
        name: 'Cash',
        currency: 'AUD',
        type: 'cash',
        balance: 20,
      },
    });

    expect(buildWalletCreateRow({ name: 'Cash', currency: 'AUD', type: 'cash', balance: '0' }, { userId: 'u' }))
      .toMatchObject({ ok: false, error: 'Aucun voyage actif (travel_id introuvable).' });
    expect(buildWalletEditPatch({ name: ' Banque ', type: 'bank' }))
      .toEqual({ ok: true, value: { name: 'Banque', type: 'bank' } });
  });

  it('builds archive/delete/type-update decisions', () => {
    expect(buildWalletArchivePatch({ archived: true, now: () => 'now' }))
      .toEqual({ archived: true, archived_at: 'now' });
    expect(buildWalletArchivePatch({ archived: false, now: () => 'now' }))
      .toEqual({ archived: false, archived_at: null });

    expect(canDeleteWallet({ transactions: [] })).toEqual({ ok: true });
    expect(canDeleteWallet({ transactions: [{ id: 'tx-1' }] }))
      .toMatchObject({ ok: false, error: 'Impossible de supprimer : des transactions existent sur ce wallet.' });

    expect(normalizeWalletTypeUpdates([{ wid: 'w1', type: 'Bank' }]))
      .toEqual({ ok: true, value: [{ wid: 'w1', type: 'bank' }] });
    expect(normalizeWalletTypeUpdates([{ wid: 'w1', type: 'bad' }]))
      .toMatchObject({ ok: false, error: 'Type invalide pour w1' });
  });
});
