import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Trip shared modal migration', () => {
  const source = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
  const tripView = fs.readFileSync('src/features/trip/tripView.js', 'utf8');
  const sharedCss = fs.readFileSync('src/ui/shared.css', 'utf8');

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
    expect(tripView).toContain('for="tripSettleWallet"');
    expect(tripView).toContain('for="tripSettleCurrency"');
    expect(tripView).toContain('for="tripSettleAmount"');
  });

  it('keeps the visible amount mode and switches from auto to guided manual attribution', () => {
    expect(source).toContain('mode: "amount_auto"');
    expect(source).toContain('box.dataset.auto = hadManualAmount ? "0" : "1"');
    expect(source).toContain('box.dataset.auto = "0"');
    expect(source).toContain('tripView?.renderTripSplitBox');
    expect(source).toContain('Math.round((total - assigned) * 100) / 100');
    expect(tripView).toContain('data-auto="1"');
    expect(source).toContain('Reste à attribuer');
    expect(source).toContain('statusEl.className = `pill ${remaining ?');
    expect(source).toContain('mode: mode === "amount" && _el("trip-split-box")?.dataset?.auto === "1" ? "amount_auto" : mode');
  });

  it('keeps the Trip expense sheet adapted to mobile screens', () => {
    expect(tripView).toContain('trip-expense-form-grid--amount');
    expect(tripView).toContain('class="trip-split-table"');
    expect(tripView).toContain('data-label="Montant"');
    expect(sharedCss).toContain('@media (max-width: 640px)');
    expect(sharedCss).toContain('.tb-trip-expense-modal');
    expect(sharedCss).toContain('max-height: 100dvh');
    expect(sharedCss).toContain('.tb-trip-expense-modal .trip-split-table thead');
    expect(sharedCss).toContain('position: sticky');
  });

  it('forces income-only controls hidden in expense mode despite strong mobile grid rules', () => {
    expect(tripView).toContain('hidden style="display:none!important;"');
    expect(source).toContain('node.hidden = !isIncome;');
    expect(source).toContain('node.style.setProperty("display", "none", "important");');
    expect(source).toContain('node.style.removeProperty("display");');
  });
});
