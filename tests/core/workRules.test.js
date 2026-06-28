import { describe, expect, it } from 'vitest';
import { summarizeWorkCareer, workDayNetMinutes } from '../../src/core/workRules.js';

describe('work career rules', () => {
  it('deducts breaks from worked time', () => {
    expect(workDayNetMinutes({ duration_minutes: 480, break_minutes: 30 })).toBe(450);
  });

  it('derives net hourly rate from received income and linked work days', () => {
    const summary = summarizeWorkCareer({
      engagements: [{ id: 'farm', name: 'Farm' }],
      days: [
        { engagement_id: 'farm', duration_minutes: 480, break_minutes: 30 },
        { engagement_id: 'farm', duration_minutes: 510, break_minutes: 30 },
      ],
      incomes: [{ engagement_id: 'farm', net_amount: 480 }],
    });
    expect(summary.totals.netHours).toBe(15.5);
    expect(summary.totals.totalReceived).toBe(480);
    expect(summary.totals.hourlyNet).toBeCloseTo(30.97, 2);
  });

  it('keeps unassigned unemployment income separate from jobs', () => {
    const summary = summarizeWorkCareer({
      engagements: [{ id: 'job', name: 'Job' }],
      days: [{ engagement_id: 'job', duration_minutes: 60 }],
      incomes: [{ engagement_id: null, income_type: 'unemployment_benefit', net_amount: 200 }],
    });
    expect(summary.engagements).toHaveLength(2);
    expect(summary.totals.totalReceived).toBe(200);
  });
});
