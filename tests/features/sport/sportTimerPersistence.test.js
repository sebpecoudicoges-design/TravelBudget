import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFreeTimerState,
  clearTimerState,
  freeTimerElapsedSeconds,
  loadFreeTimerState,
  loadTimerPrefs,
  loadTimerState,
  normalizeFreeTimerState,
  normalizeTimerState,
  persistFreeTimerState,
  persistTimerState,
  saveTimerPrefs,
} from '../../../src/features/sport/sportTimerController.js';

function installLocalStorage() {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  });
  return store;
}

describe('Sport timer persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    installLocalStorage();
  });

  it('loads and clamps timer preferences', () => {
    expect(loadTimerPrefs('prefs')).toEqual({ beepVolume: 70 });
    const cache = {};
    expect(saveTimerPrefs({ beepVolume: 180 }, { storageKey: 'prefs', cache })).toEqual({ beepVolume: 100 });
    expect(cache.timerBeepVolume).toBe(100);
    expect(saveTimerPrefs({ beepVolume: -5 }, { storageKey: 'prefs', cache })).toEqual({ beepVolume: 0 });
  });

  it('normalizes, persists and clears guided timer state', () => {
    const timer = normalizeTimerState({
      sequence: [{ kind: 'work', itemIndex: 0, item: { exerciseName: 'Bench' }, duration: 30 }],
      planSnapshot: [{ exerciseName: 'Bench' }],
      doneSets: new Array(600).fill({ reps: 10 }),
      index: '2.7',
      startedAt: '1000',
      stepStartedAt: '1200',
      stepEndAt: '40000',
      paused: true,
      pauseStartedAt: '1500',
    });
    expect(timer.index).toBe(3);
    expect(timer.doneSets).toHaveLength(500);
    expect(persistTimerState(timer, { storageKey: 'timer' })).toBe(true);
    expect(loadTimerState('timer')).toMatchObject({
      index: 3,
      paused: true,
      planSnapshot: [{ exerciseName: 'Bench' }],
    });
    clearTimerState('timer');
    expect(loadTimerState('timer')).toBe(null);
  });

  it('normalizes free timer state and computes elapsed seconds while paused', () => {
    const timer = normalizeFreeTimerState({
      item: { key: 'run', mode: 'distance' },
      startedAt: 1000,
      paused: true,
      pauseStartedAt: 61000,
      pausedAccumMs: 10000,
      resultReps: '12',
      resultWeightKg: '20.5',
      resultDistanceM: '1500',
    }, { bodyWeightKg: 59, bodyHeightCm: 162 });
    expect(timer).toMatchObject({ bodyWeightKg: 59, bodyHeightCm: 162, resultDistanceM: 1500 });
    expect(freeTimerElapsedSeconds(timer, 120000)).toBe(50);
  });

  it('persists and clears free timer state', () => {
    expect(persistFreeTimerState({
      item: { key: 'jump_rope' },
      startedAt: 1000,
      stoppedAt: 61000,
      bodyWeightKg: 59,
      bodyHeightCm: 162,
    }, { storageKey: 'free' })).toBe(true);
    expect(loadFreeTimerState('free')).toMatchObject({ item: { key: 'jump_rope' }, stoppedAt: 61000 });
    clearFreeTimerState('free');
    expect(loadFreeTimerState('free')).toBe(null);
  });
});
