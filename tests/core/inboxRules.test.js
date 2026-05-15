import { describe, expect, it } from 'vitest';
import {
  inferInboxDraft,
  parseInboxText,
  scoreInboxTransaction,
  sortInboxTransactionCandidates,
} from '../../src/core/inboxRules.js';

describe('inbox rules core', () => {
  it('parses amount, currency and remaining label', () => {
    expect(parseInboxText('Coles 24.50 AUD')).toEqual({ amount: 24.5, currency: 'AUD', label: 'Coles' });
    expect(parseInboxText('12,30 eur coffee')).toEqual({ amount: 12.3, currency: 'EUR', label: 'coffee' });
  });

  it('infers a lightweight draft from common receipt words', () => {
    const draft = inferInboxDraft({ raw_text: 'Coles 24.50 AUD' }, { categories: ['Courses', 'Transport'], defaultCategory: 'Autre' });
    expect(draft).toMatchObject({ amount: 24.5, currency: 'AUD', label: 'Coles', category: 'Courses', type: 'expense' });
  });

  it('scores likely matching transactions above weak candidates', () => {
    const item = { raw_text: 'Coles 24.50 AUD', created_at: '2026-05-12T10:00:00Z' };
    const good = { label: 'Coles supermarket', amount: 24.5, currency: 'AUD', dateStart: '2026-05-12' };
    const weak = { label: 'Hostel', amount: 90, currency: 'AUD', dateStart: '2026-04-01' };

    expect(scoreInboxTransaction(item, good).score).toBeGreaterThan(70);
    expect(scoreInboxTransaction(item, weak).score).toBeLessThan(30);
    expect(sortInboxTransactionCandidates(item, [weak, good]).map((x) => x.tx.label)).toEqual(['Coles supermarket', 'Hostel']);
  });
});
