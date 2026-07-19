import { describe, expect, it } from 'vitest';
import {
  renderDurationOptions,
  renderEquipmentOptions,
  renderExerciseOptions,
  renderFormatOptions,
  renderOptionRows,
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
});
