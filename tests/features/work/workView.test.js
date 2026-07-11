import { describe, expect, it } from 'vitest';

import { renderWorkCareerPanel, renderWorkLoadPanel, summarizeWorkWeek, todayWorkLabel } from '../../../src/features/work/workView.js';

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

  it('renders the career panel with timeline, KPIs and stable action hooks', () => {
    const html = renderWorkCareerPanel({
      data: {
        engagements: [{ id: 'job-1', name: 'Farm Eco-lodge', employer: 'Fruitful', start_date: '2026-06-08', currency: 'AUD', color: '#0ea5e9' }],
        incomes: [{ id: 'inc-1', engagement_id: 'job-1', received_date: '2026-06-26', net_amount: 3379, currency: 'AUD' }],
        statuses: [{ id: 'status-1', label: 'Chomage', start_date: '2026-06-01', end_date: '2026-06-07', color: '#94a3b8' }],
        folders: [{ id: 'folder-1', name: 'Contrats' }],
        links: [{ id: 'link-1', engagement_id: 'job-1', folder_id: 'folder-1' }],
      },
      careerSummary: {
        totals: { totalReceived: 3379, netHours: 115, hourlyNet: 29.38 },
        engagements: [{ engagement: { id: 'job-1' }, netHours: 115, totalReceived: 3379, hourlyNet: 29.38 }],
      },
      today: '2026-07-01',
      money: (value, currency) => `${Math.round(value)} ${currency}`,
      shortDate: (value) => String(value).slice(5),
      t,
    });

    expect(html).toContain('Parcours professionnel');
    expect(html).toContain('3379 AUD');
    expect(html).toContain('115h');
    expect(html).toContain('29 AUD/h');
    expect(html).toContain('data-career-open="job"');
    expect(html).toContain('data-career-edit-job="job-1"');
    expect(html).toContain('data-career-edit-income="inc-1"');
    expect(html).toContain('data-career-edit-status="status-1"');
    expect(html).toContain('data-career-unlink="link-1"');
    expect(html).toContain('Contrats');
  });
});
