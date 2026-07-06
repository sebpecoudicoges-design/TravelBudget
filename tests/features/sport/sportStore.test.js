import { describe, expect, it, vi } from 'vitest';
import { createEntityStore } from '../../../src/data/entityStore.js';
import { createSportStore } from '../../../src/features/sport/sportStore.js';

describe('Sport store', () => {
  it('keeps Sport state in entityStore and notifies domain subscribers', () => {
    const entityStore = createEntityStore();
    const store = createSportStore({}, { entityStore });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPlan([{ exerciseName: 'Squat' }]);

    expect(store.state.plan).toEqual([{ exerciseName: 'Squat' }]);
    expect(entityStore.get('sport').plan).toEqual([{ exerciseName: 'Squat' }]);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ plan: [{ exerciseName: 'Squat' }] }), 'sport');
  });

  it('hydrates a remote aggregate while excluding pending deletions and orphan children', () => {
    const store = createSportStore();
    store.hydrateRemote({
      sessions: [{ id: 'keep' }, { id: 'delete' }],
      items: [
        { id: 'item-keep', session_id: 'keep' },
        { id: 'item-delete', session_id: 'delete' },
      ],
      sets: [
        { id: 'set-keep', item_id: 'item-keep' },
        { id: 'set-delete', item_id: 'item-delete' },
      ],
    }, ['delete']);

    expect(store.state.sessions).toEqual([{ id: 'keep' }]);
    expect(store.state.items).toEqual([{ id: 'item-keep', session_id: 'keep' }]);
    expect(store.state.sets).toEqual([{ id: 'set-keep', item_id: 'item-keep' }]);
  });

  it('keeps local workouts replayable and updates their date without mutating the original', () => {
    const store = createSportStore();
    const workout = {
      localId: 'local-1',
      startedAt: '2026-07-06T08:00:00',
      endedAt: '2026-07-06T08:45:00',
      localOnly: true,
    };
    store.rememberLocalWorkout(workout);
    expect(store.updateLocalWorkoutDate('local-1', '2026-07-07')).toBe(true);
    store.markLocalSynced('local-1', 'remote-1');

    expect(workout.startedAt).toBe('2026-07-06T08:00:00');
    expect(store.state.localSessions[0]).toMatchObject({
      startedAt: '2026-07-07T08:00:00',
      endedAt: '2026-07-07T08:45:00',
      localOnly: false,
      remoteId: 'remote-1',
    });
  });

  it('deduplicates pending deletes and removes a workout aggregate optimistically', () => {
    const store = createSportStore({
      sessions: [{ id: 'session-1' }],
      items: [{ id: 'item-1', session_id: 'session-1' }],
      sets: [{ id: 'set-1', item_id: 'item-1' }],
      localSessions: [{ localId: 'local-1', remoteId: 'session-1' }],
    });
    store.rememberPendingDelete('session-1');
    store.rememberPendingDelete('session-1');
    store.removeWorkout('session-1');

    expect(store.state.pendingDeletes).toEqual(['session-1']);
    expect(store.state.sessions).toEqual([]);
    expect(store.state.items).toEqual([]);
    expect(store.state.sets).toEqual([]);
    expect(store.state.localSessions).toEqual([]);
  });

  it('hydrates the offline snapshot and exports the legacy app shape', () => {
    const store = createSportStore();
    store.hydrateOffline({
      sportSessions: [{ id: 'session-1' }],
      sportSessionItems: [{ id: 'item-1' }],
      sportSets: [{ id: 'set-1' }],
    });

    expect(store.appSnapshot()).toEqual({
      sportSessions: [{ id: 'session-1' }],
      sportSessionItems: [{ id: 'item-1' }],
      sportSets: [{ id: 'set-1' }],
    });
  });
});
