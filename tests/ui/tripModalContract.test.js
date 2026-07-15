import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Trip shared modal migration', () => {
  const source = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');

  it('routes the five priority Trip windows through the shared modal', () => {
    expect(source.match(/window\.UI\.createModal\(\{/g)).toHaveLength(5);
    for (const id of ['trip-match-modal', 'tripSettleModal', 'trip-expense-docs-modal', 'tripExpenseDetailModal', 'trip-expense-editor-modal']) {
      expect(source).toContain(`id: "${id}"`);
    }
  });

  it('removes the legacy Trip modal backdrops', () => {
    expect(source).not.toContain('trip-edit-exp-overlay');
    expect(source).not.toContain('tripSettleClose');
    expect(source).not.toContain('tripExpDetailClose');
    expect(source).not.toContain('modal.style.display = "flex"');
  });

  it('keeps focus targets and accessible field labels', () => {
    expect(source).toContain('initialFocus: "#trip-match-search"');
    expect(source).toContain('initialFocus: "#tripSettleWallet"');
    expect(source).toContain('initialFocus: "#trip-exp-label"');
    expect(source).toContain('for="tripSettleWallet"');
    expect(source).toContain('for="tripSettleCurrency"');
    expect(source).toContain('for="tripSettleAmount"');
  });

  it('keeps the visible amount mode while delegating smart remaining split to rules', () => {
    expect(source).toContain('mode: "amount_auto"');
    expect(source).toContain('box.dataset.auto = "1"');
    expect(source).toContain('data-auto="1"');
    expect(source).toContain('mode: mode === "amount" && _el("trip-split-box")?.dataset?.auto === "1" ? "amount_auto" : mode');
  });
});
