import { describe, expect, it } from 'vitest';
import {
  renderDurationOptions,
  renderEquipmentOptions,
  renderExerciseOptions,
  renderFormatOptions,
  renderOptionRows,
  renderSportPlan,
} from '../../../src/features/sport/sportFormView.js';

describe('Sport form view', () => {
  it('renders translated option rows and escapes labels', () => {
    const html = renderOptionRows({
      rows: [['strength', '<Force>', 'Strength'], ['cardio', 'Cardio', 'Cardio']],
      selected: 'strength',
      language: 'fr',
    });

    expect(html).toContain('value="strength" selected');
    expect(html).toContain('&lt;Force&gt;');
    expect(html).toContain('value="cardio"');
  });

  it('renders duration, format, equipment and exercise options with stable values', () => {
    expect(renderDurationOptions({ selected: 45 })).toContain('value="45" selected');
    expect(renderFormatOptions({ selected: 'reps', labels: { reps: 'Reps' } })).toContain('value="reps" selected');

    const equipment = renderEquipmentOptions({
      equipment: [['dumbbell', 'Haltere', 'Dumbbell']],
      selected: 'dumbbell',
      language: 'en',
      allLabel: 'All',
    });
    expect(equipment).toContain('value="all"');
    expect(equipment).toContain('Dumbbell');
    expect(equipment).toContain('value="dumbbell" selected');

    const exercises = renderExerciseOptions({
      exercises: [{ key: 'bench', fr: '<Developpe>' }],
      selected: 'bench',
      emptyLabel: 'Choisir',
      exerciseLabel: (exercise) => exercise.fr,
    });
    expect(exercises).toContain('value=""');
    expect(exercises).toContain('value="bench" selected');
    expect(exercises).toContain('&lt;Developpe&gt;');
  });

  it('renders a delegated workout plan with controls and progression chips', () => {
    const html = renderSportPlan({
      plan: [{
        activityKey: 'strength',
        equipment: 'barbell',
        exerciseName: 'Developpe couche',
        mode: 'reps',
        targetReps: 8,
        repMin: 6,
        repMax: 10,
        sets: 3,
        restSeconds: 180,
        weightKg: 60,
        loadLabel: 'barre',
        intensityLabel: 'forte',
      }],
      labels: {
        progression: 'Progression',
        sets: 'series',
        rest: 'repos',
        intensity: 'Intensite',
        edit: 'Modifier',
      },
      helpers: {
        n: (value, fallback = 0) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        },
        progressionRepRange: () => ({ min: 6, max: 10 }),
        labelActivity: () => 'Force',
        labelEquipment: () => 'Barre',
        supportsExternalLoad: () => true,
        restSecondsForItem: () => 180,
        calibratedMet: () => 5.45,
      },
    });

    expect(html).toContain('1. Developpe couche');
    expect(html).toContain('60 kg');
    expect(html).toContain('6-10 reps');
    expect(html).toContain('3 series');
    expect(html).toContain('180 sec repos');
    expect(html).toContain('MET 5.5');
    expect(html).toContain('data-sport-edit="0"');
    expect(html).toContain('data-sport-remove="0"');
  });

  it('renders an empty workout plan message', () => {
    const html = renderSportPlan({
      plan: [],
      labels: { emptyPlan: 'Ajoute un exercice' },
    });

    expect(html).toContain('class="muted"');
    expect(html).toContain('Ajoute un exercice');
  });
});
