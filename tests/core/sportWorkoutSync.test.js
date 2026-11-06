import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { buildSportPersistenceRows } from '../../src/core/sportRules.js';

const source = fs.readFileSync('public/legacy/js/45_sport_ui.js', 'utf8');
const saveFunctions = source.slice(source.indexOf('  async function saveWorkout('), source.indexOf('  async function syncLocalWorkouts('));

describe('Sport local acknowledgement', () => {
  function harness() {
    const row = { localId: 'stable-key', durationSeconds: 120, startedAt: '2026-11-07T01:00:00Z',
      endedAt: '2026-11-07T01:02:00Z', plan: [{ exerciseName: 'Bench' }], doneSets: [{ itemIndex: 0, setIndex: 1, reps: 8 }] };
    const createWorkout = vi.fn();
    const markLocalSynced = vi.fn();
    let account = 'u';
    const context = vm.createContext({
      CACHE: { savingWorkoutKeys: new Set() }, workoutFingerprint: () => 'fingerprint',
      rememberLocalWorkout: () => row, client: () => ({}), uid: () => account, activeTravelId: () => null,
      sportRepository: () => ({ createWorkout }), txt: f => f, console: { warn() {} },
      window: { Core: { sportRules: { buildSportPersistenceRows } } },
      markLocalSynced, syncWorkoutLoadProgression: async () => [], loadHistory: async () => {},
    });
    vm.runInContext(saveFunctions, context);
    return { context, row, createWorkout, markLocalSynced, switchAccount() { account = 'other'; } };
  }
  it('keeps a failed live save pending and submits the same full workout on retry', async () => {
    const h = harness();
    h.createWorkout.mockRejectedValueOnce(Error('set refused')).mockResolvedValueOnce({ sessionId: 'remote' });
    await h.context.saveWorkout(h.row);
    expect(h.markLocalSynced).not.toHaveBeenCalled();
    await expect(h.context.syncLocalWorkoutRow(h.row)).resolves.toBe(true);
    expect(h.createWorkout.mock.calls[0]).toEqual(h.createWorkout.mock.calls[1]);
    expect(h.createWorkout.mock.calls[0][0]).toMatchObject({ syncKey: 'stable-key', rows: { sets: [{ itemIndex: 0, reps: 8 }] } });
    expect(h.markLocalSynced).toHaveBeenCalledExactlyOnceWith('stable-key', 'remote');
  });
  it('keeps the local acknowledgement scoped to the account that sent the workout', async () => {
    const h = harness();
    h.createWorkout.mockImplementation(async () => { h.switchAccount(); return { sessionId: 'remote' }; });
    await expect(h.context.syncLocalWorkoutRow(h.row)).resolves.toBe(false);
    expect(h.markLocalSynced).not.toHaveBeenCalled();
  });
});
