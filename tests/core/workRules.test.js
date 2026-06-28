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
    expect(summary.totals.hourlyNet).toBe(0);
  });

  it('attributes legacy unassigned days when exactly one job covers the date', () => {
    const summary = summarizeWorkCareer({
      engagements: [{ id: 'farm', name: 'Farm', start_date: '2026-06-08', end_date: null }],
      days: [{ engagement_id: null, work_date: '2026-06-20', duration_minutes: 480, break_minutes: 30 }],
      incomes: [
        { engagement_id: 'farm', income_type: 'salary', net_amount: 900 },
        { engagement_id: null, income_type: 'unemployment_benefit', net_amount: 400 },
      ],
    });
    const farm = summary.engagements.find((item) => item.engagement?.id === 'farm');
    expect(farm.netHours).toBe(7.5);
    expect(farm.hourlyNet).toBe(120);
    expect(summary.totals.hourlyNet).toBe(120);
    expect(summary.totals.totalReceived).toBe(1300);
  });

  it('does not guess a job when engagement periods overlap', () => {
    const summary = summarizeWorkCareer({
      engagements: [
        { id: 'one', start_date: '2026-06-01', end_date: '2026-06-30' },
        { id: 'two', start_date: '2026-06-15', end_date: null },
      ],
      days: [{ engagement_id: null, work_date: '2026-06-20', duration_minutes: 60 }],
    });
    const unassigned = summary.engagements.find((item) => !item.engagement);
    expect(unassigned.netHours).toBe(1);
  });
});
