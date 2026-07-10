import { describe, expect, it } from 'vitest';

import { renderWorkLoadPanel, summarizeWorkWeek, todayWorkLabel } from '../../../src/features/work/workView.js';

describe('Work view helpers', () => {
  const t = (fr) => fr;

  it('summarizes weekly work load and labels today', () => {
    const rows = [
      { day: '2026-07-05', kcal: 0, minutes: 0, plannedRest: true },
      { day: '2026-07-06', kcal: 420, minutes: 480, count: 1, labels: ['Farm'] },
    ];
    expect(summarizeWorkWeek(rows)).toMatchObject({ kcal: 420, hours: 8, maxKcal: 420 });
    expect(todayWorkLabel(rows[1], { t })).toContain("Aujourd'hui");
    expect(todayWorkLabel(rows[0], { t })).toContain('Repos');
  });

  it('renders the rhythm panel with stable hooks', () => {
    const html = renderWorkLoadPanel({
      rows: [
        { day: '2026-07-05', kcal: 0, minutes: 0, plannedRest: true, labels: [] },
        { day: '2026-07-06', kcal: 420, minutes: 480, count: 1, labels: ['Farm'] },
      ],
      rhythm: { mode: 'weekend_rest' },
      shortDay: (day) => day.slice(5),
      t,
    });
    expect(html).toContain('Rythme &amp; charge');
    expect(html).toContain('id="work-rhythm"');
    expect(html).toContain('id="work-rest-today"');
    expect(html).toContain('420 kcal');
  });
});
