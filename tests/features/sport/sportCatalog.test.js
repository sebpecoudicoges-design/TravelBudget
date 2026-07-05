import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  EQUIPMENT,
  EXERCISE_LIBRARY,
  PROGRAM_LOADS,
  SPORT_FAMILIES,
} from '../../../src/features/sport/sportCatalog.js';

describe('sport catalog', () => {
  it('keeps exercise keys unique', () => {
    const keys = EXERCISE_LIBRARY.map((exercise) => exercise.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('references known activities and equipment', () => {
    const activityKeys = new Set(CATALOG.map((activity) => activity.key));
    const equipmentKeys = new Set(EQUIPMENT.map(([key]) => key));

    expect(EXERCISE_LIBRARY.every((exercise) => activityKeys.has(exercise.activityKey))).toBe(true);
    expect(EXERCISE_LIBRARY.every((exercise) => equipmentKeys.has(exercise.equipment))).toBe(true);
  });

  it('covers the main training families and reference loads', () => {
    const equipment = [...new Set(EXERCISE_LIBRARY.map((exercise) => exercise.equipment))];
    const families = [...new Set(SPORT_FAMILIES.map(([key]) => key))];
    const loadNames = [...new Set(PROGRAM_LOADS.map(([name]) => name))];

    expect(equipment).toEqual(expect.arrayContaining(['bodyweight', 'band', 'dumbbell', 'barbell', 'machine', 'boxing']));
    expect(families).toEqual(expect.arrayContaining(['push', 'pull', 'legs', 'core', 'cardio', 'boxing']));
    expect(loadNames).toEqual(expect.arrayContaining(['Squat arriere', 'Rowing haltere un bras', 'Developpe couche']));
  });

  it('keeps heavy bag intensity above jump rope', () => {
    const boxing = CATALOG.find((activity) => activity.key === 'boxing');
    const jumpRope = CATALOG.find((activity) => activity.key === 'jump_rope');
    const heavyBag = EXERCISE_LIBRARY.find((exercise) => exercise.key === 'boxing_heavy_bag');

    expect(boxing.met).toBeGreaterThan(jumpRope.met);
    expect(heavyBag.metValue).toBe(boxing.met);
  });
});
