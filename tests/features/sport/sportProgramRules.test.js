import { describe, expect, it } from 'vitest';
import {
  currentProgramWeek,
  plannedSportWeekRows,
  programDaysFromSqlSessions,
  sessionCode,
} from '../../../src/features/sport/sportProgramRules.js';

describe('sport program rules', () => {
  const sessions = [
    { id: 'sql_A1', sessionKey: 'A1', name: 'A1' },
    { id: 'sql_B1', sessionKey: 'B1', name: 'B1' },
    { id: 'sql_A2', sessionKey: 'A2', name: 'A2' },
    { id: 'sql_B2', sessionKey: 'B2', name: 'B2' },
  ];

  it('extracts canonical A/B session codes', () => {
    expect(sessionCode({ id: 'sql_A2' })).toBe('A2');
    expect(sessionCode({ name: 'Semaine B - B3' })).toBe('B3');
  });

  it('alternates A and B from the configured start week', () => {
    const program = { cycle: 'A/B', startDate: '2026-06-22' };
    expect(currentProgramWeek(program, '2026-06-23')).toBe('A');
    expect(currentProgramWeek(program, '2026-06-30')).toBe('B');
  });

  it('builds the current week with planned and rest days', () => {
    const program = { enabled: true, cycle: 'A/B', startDate: '2026-06-22', days: { 2: 'A1/B1', 4: 'A2/B2' } };
    const days = plannedSportWeekRows(sessions, program, '2026-06-30');

    expect(days).toHaveLength(7);
    expect(days[1]).toMatchObject({ day: '2026-06-30', code: 'B1', planned: true });
    expect(days[2]).toMatchObject({ day: '2026-07-01', planned: false });
    expect(days[3]).toMatchObject({ day: '2026-07-02', code: 'B2', planned: true });
  });

  it('derives editable planning days from SQL sessions', () => {
    expect(programDaysFromSqlSessions([
      { session_key: 'A1', day_of_week: 2, sort_order: 1 },
      { session_key: 'B1', day_of_week: 2, sort_order: 2 },
      { session_key: 'A2', day_of_week: 4, sort_order: 3 },
    ])).toEqual({ 2: 'A1/B1', 4: 'A2' });
  });
});
