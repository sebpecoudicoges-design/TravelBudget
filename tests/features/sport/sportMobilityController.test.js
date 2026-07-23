import { describe, expect, it } from 'vitest';
import { saveMobilityAssessment } from '../../../src/features/sport/sportMobilityController.js';

function assessmentRoot(levels = {}) {
  return {
    querySelector(selector) {
      const level = selector.match(/data-sport-mobility-level="([^"]+)"/)?.[1];
      if (level) return { value: levels[level] ?? '' };
      const pain = selector.match(/data-sport-mobility-pain="([^"]+)"/)?.[1];
      if (pain) return { value: pain === 'trunk_rotation' ? '2' : '0' };
      return null;
    },
  };
}

describe('Sport mobility controller', () => {
  it('requires all five simple tests', async () => {
    const result = await saveMobilityAssessment({
      root: assessmentRoot({ toe_touch: '2' }),
      cache: { mobilityAssessments: [] },
      storageKey: 'test-mobility',
      numberValue: (value, fallback = 0) => Number(value) || fallback,
    });
    expect(result).toMatchObject({ ok: false, reason: 'incomplete' });
  });

  it('builds a local five-test assessment and score', async () => {
    const cache = { mobilityAssessments: [] };
    const result = await saveMobilityAssessment({
      root: assessmentRoot({
        toe_touch: '2',
        deep_squat: '1',
        shoulder_reach: '2',
        trunk_rotation: '1',
        ankle_wall: '1',
      }),
      cache,
      storageKey: 'test-mobility',
      numberValue: (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      },
    });
    expect(result.ok).toBe(true);
    expect(result.score10).toBe(7);
    expect(result.rows).toHaveLength(5);
    expect(result.rows.find((row) => row.test_code === 'trunk_rotation').central_pain).toBe(2);
    expect(cache.mobilityAssessments).toHaveLength(5);
  });
});
