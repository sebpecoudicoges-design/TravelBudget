import { describe, expect, it } from 'vitest';
import {
  currentProgramWeek,
  nextMondayISO,
  plannedSportWeekRows,
  progressionIncrementKg,
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

  it('finds the next Monday without shifting an existing Monday', () => {
    expect(nextMondayISO('2026-07-06')).toBe('2026-07-06');
    expect(nextMondayISO('2026-07-07')).toBe('2026-07-13');
  });

  it('increments paired dumbbells per hand and keeps single dumbbells per implement', () => {
    expect(progressionIncrementKg({ equipment: 'dumbbell', loadLabel: '2 x 15 kg' })).toBe(2);
    expect(progressionIncrementKg({ equipment: 'dumbbell', exerciseName: 'Curl halteres' })).toBe(1);
    expect(progressionIncrementKg({ equipment: 'barbell', exerciseName: 'Squat arriere' })).toBe(5);
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
      { session_key: 'A1', day_of_week: 1, sort_order: 1 },
      { session_key: 'B1', day_of_week: 1, sort_order: 2 },
      { session_key: 'A2', day_of_week: 3, sort_order: 3 },
    ])).toEqual({ 1: 'A1/B1', 3: 'A2' });
  });

  it('falls back to Monday, Wednesday and Friday planning', () => {
    expect(programDaysFromSqlSessions([])).toEqual({ 1: 'A1/B1', 3: 'A2/B2', 5: 'A3/B3' });
  });
});
