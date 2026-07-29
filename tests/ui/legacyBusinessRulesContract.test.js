import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('legacy business rules contract', () => {
  it('keeps the no-new-business-rules rule documented and guarded', () => {
    const checklist = fs.readFileSync('docs/V11_REFACTOR_CHECKLIST.md', 'utf8');
    const files = fs.readdirSync('public/legacy/js').filter((file) => file.endsWith('.js'));

    expect(checklist).toContain('- [x] Ne plus ajouter de nouvelle regle metier dans `public/legacy/js`.');
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = fs.readFileSync(`public/legacy/js/${file}`, 'utf8');
      expect(source, file).not.toContain('export function');
      expect(source, file).not.toContain('export const');
    }
  });

  it('keeps removed dead legacy helpers out of Trip and Sport', () => {
    const trip = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
    const sport = fs.readFileSync('public/legacy/js/45_sport_ui.js', 'utf8');

    for (const token of [
      'function _shareText',
      'function _unlinkExpenseFromTransaction',
      'function _fetchBalancesFromDb',
      'function _fetchSettlementSuggestionsFromDb',
      'function _recordSettlementAndTx',
    ]) {
      expect(trip).not.toContain(token);
    }

    for (const token of [
      'function isPendingDeleted',
      'function goalOptions',
      'function durationOptions',
      'function simpleExerciseOptions',
      'function formatOptions',
    ]) {
      expect(sport).not.toContain(token);
    }
  });

  it('keeps removed dead legacy helpers out of Analysis and Documents', () => {
    const analysis = fs.readFileSync('public/legacy/js/33_budget_analysis.js', 'utf8');
    const documents = fs.readFileSync('public/legacy/js/43_documents_ui.js', 'utf8');

    expect(analysis).not.toContain('function _referenceDailyForDate');
    expect(documents).not.toContain('function extFromName');
  });
});
