import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { measureSourceGroups, formatReport } from '../../scripts/check-module-budgets.mjs';

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
      'testing-domain',
      'trip-domain',
      'sport-domain',
      'nutrition-domain',
      'work-domain',
      'assets-domain',
      'documents-domain',
    ]));
  });

  it('keeps source groups under their current V11 budgets', () => {
    for (const group of measureSourceGroups(config)) {
      expect(group.missing, group.name).toEqual([]);
      expect(group.sizeKiB, group.name).toBeLessThanOrEqual(group.maxKiB);
    }
  });

  it('formats a readable report for release checks', () => {
    const report = {
      sourceGroups: measureSourceGroups(config),
      dist: {
        available: true, initialJsKiB: 100, lazyJsKiB: 200,
        totalJsKiB: 300, totalCssKiB: 40, mainJsGzipKiB: 30,
        budgets: config.dist,
      },
    };
    expect(formatReport(report)).toContain('Module size budget report');
    expect(formatReport(report)).toContain('boot-legacy');
    expect(formatReport(report)).toContain('Initial JS');
    expect(formatReport(report)).toContain('Lazy JS');
  });

  it('explains when compilation has not yet produced assets', () => {
    const output = formatReport({
      sourceGroups: [],
      dist: { available: false, reason: 'Build required before measurement' },
    });
    expect(output).toContain('Build required before measurement');
    expect(output).not.toContain('Initial JS');
  });
});
