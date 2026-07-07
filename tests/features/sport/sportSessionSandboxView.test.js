import { describe, expect, it } from 'vitest';
import {
  renderSandboxActions,
  renderSandboxContent,
  renderSandboxSetList,
  renderSandboxSetRow,
} from '../../../src/features/sport/sportSessionSandboxView.js';

const api = {
  translate: (fr) => fr,
  escapeHTML: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]),
  numberValue: (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  formatSeconds: (seconds) => `${Math.round(Number(seconds || 0))}s`,
  labelActivity: (key) => ({ strength: 'Musculation', core: 'Core' }[key] || key),
  supportsExternalLoad: (item) => item?.equipment === 'barbell',
  lastLoadForExercise: () => 75,
  setWorkSeconds: () => 45,
};

const plan = [
  { exerciseName: 'Squat arriere', activityKey: 'strength', equipment: 'barbell', mode: 'reps', targetReps: 10, metValue: 6.5 },
  { exerciseName: 'Gainage', activityKey: 'core', equipment: 'bodyweight', mode: 'time', targetSeconds: 60, metValue: 3.8 },
];

describe('Sport session sandbox view', () => {
  it('renders an editable loaded set row and keeps stable data attributes', () => {
    const html = renderSandboxSetRow({
      set: { itemIndex: 0, setIndex: 2, reps: 12, durationSeconds: 70, weightKg: 80 },
      index: 0,
      plan,
      api,
    });

    expect(html).toContain('Squat arriere');
    expect(html).toContain('Serie 2');
    expect(html).toContain('data-sport-sandbox-reps="0"');
    expect(html).toContain('value="12"');
    expect(html).toContain('data-sport-sandbox-load="0"');
    expect(html).toContain('value="80"');
    expect(html).toContain('data-sport-sandbox-delete="0"');
  });

  it('disables reps and load for time bodyweight rows', () => {
    const html = renderSandboxSetRow({
      set: { itemIndex: 1, setIndex: 1, reps: null, durationSeconds: 90, weightKg: 0 },
      index: 1,
      plan,
      api,
    });

    expect(html).toContain('Gainage');
    expect(html).toContain('data-sport-sandbox-reps="1"');
    expect(html).toContain('disabled');
    expect(html).toContain('data-sport-sandbox-load="1"');
  });

  it('renders modal content with stats, add selector and set list', () => {
    const html = renderSandboxContent({
      session: { estimated_kcal: 309 },
      plan,
      doneSets: [
        { itemIndex: 0, setIndex: 1, reps: 10, durationSeconds: 60, weightKg: 75 },
        { itemIndex: 1, setIndex: 1, reps: null, durationSeconds: 90, weightKg: 0 },
      ],
      weightKg: 59,
      api,
    });

    expect(html).toContain('309 kcal');
    expect(html).toContain('id="sport-sandbox-kcal"');
    expect(html).toContain('id="sport-sandbox-set-count">2');
    expect(html).toContain('id="sport-sandbox-add-exercise"');
    expect(html).toContain('Squat arriere');
    expect(html).toContain('Gainage');
  });

  it('renders actions and set list independently for legacy refreshes', () => {
    expect(renderSandboxActions({ api })).toContain('id="sport-sandbox-save"');
    const list = renderSandboxSetList({ doneSets: [{ itemIndex: 0, setIndex: 1, reps: 10, durationSeconds: 60, weightKg: 0 }], plan, api });
    expect(list).toContain('value="75"');
  });
});
