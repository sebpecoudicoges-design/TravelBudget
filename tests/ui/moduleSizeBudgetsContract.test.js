import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { collectBudgetReport, formatReport } from '../../scripts/check-module-budgets.mjs';

describe('module size budgets', () => {
  const config = JSON.parse(fs.readFileSync('config/module-size-budgets.json', 'utf8'));

  it('covers the heavy boot and lazy-loaded domains', () => {
    const names = config.sourceGroups.map((group) => group.name);
    expect(names).toEqual(expect.arrayContaining([
      'boot-legacy',
      'cashflow-domain',
      'inbox-domain',
      'analysis-domain',
      'dashboard-settings',
      'trip-domain',
      'sport-domain',
      'nutrition-domain',
      'work-domain',
      'assets-domain',
    ]));
  });

  it('keeps source groups under their current V11 budgets', () => {
    const report = collectBudgetReport(config);
    const sourceFailures = report.failures.filter((failure) => !failure.startsWith('dist '));
    expect(sourceFailures).toEqual([]);
  });

  it('formats a readable report for release checks', () => {
    const report = collectBudgetReport(config);
    expect(formatReport(report)).toContain('Module size budget report');
    expect(formatReport(report)).toContain('boot-legacy');
    expect(formatReport(report)).toContain('Initial JS');
    expect(formatReport(report)).toContain('Lazy JS');
  });
});
