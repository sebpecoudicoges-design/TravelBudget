import { describe, expect, it } from 'vitest';
import {
  bodyMeasurementQuality,
  radarPoints,
  renderBodyMeasurementModal,
  renderExerciseProgressionAnalysis,
  renderSportProfileDashboard,
} from '../../../src/features/sport/sportProfileView.js';

const api = {
  translate: (fr) => fr,
  escapeHTML: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]),
  numberValue: (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  todayISO: () => '2026-07-08',
  bodyWeight: () => 59,
};

const data = {
  axes: [
    { key: 'lower', label: 'Jambes', value: 100, raw: 'Squat 105 kg e1RM', basis: 'squat 1.75 x PDC' },
    { key: 'push', label: 'Poussee', value: 92, raw: 'Developpe couche 73 kg e1RM', basis: 'developpe couche 1.35 x PDC' },
    { key: 'pull', label: 'Tirage', value: 100, raw: 'Tractions 12 reps PDC', basis: 'tractions strictes 12 reps' },
    { key: 'core', label: 'Core', value: 75, raw: 'Gainage 90s', basis: 'gainage 120s' },
    { key: 'cardio', label: 'Cardio', value: 81, raw: '11.4 kcal/min', basis: 'cardio 14 kcal/min' },
    { key: 'recovery', label: 'Recup.', value: 94, raw: '8h sommeil', basis: 'sommeil moyen 8.5h' },
  ],
  weakest: { key: 'core', label: 'Core', value: 75 },
  bestLoads: [{ name: 'Squat arriere', estimate: 105 }, { name: 'Developpe couche', estimate: 73 }],
  athleticProfile: {
    priority: 'augmenter endurance de 10 a 12 points',
    insights: ['Tres bon niveau de force relative.'],
    warnings: ['Developpe militaire probablement en retard par rapport au reste.'],
    keyMetrics: [{ label: 'DC', value: '1.24 x PDC', detail: '73 kg e1RM' }],
    balances: [{ label: 'Poussee / Tirage', text: 'Tirage +8%' }],
    archetypes: [
      { label: 'Grimpeur', value: 76 },
      { label: 'Powerlifter', value: 82 },
    ],
  },
};

describe('Sport profile view', () => {
  it('renders the strength radar with strict basis details and body metrics', () => {
    const html = renderSportProfileDashboard({
      data,
      latest: { measured_on: '2026-07-07', weight_kg: 59, body_fat_pct: 15, muscle_mass_kg: 47, body_water_pct: 58 },
      bodyWeightKg: 59,
      api,
    });

    expect(html).toContain('Profil forces / faiblesses');
    expect(html).toContain('Axe a renforcer');
    expect(html).toContain('Developpe couche 73 kg e1RM');
    expect(html).toContain('developpe couche 1.35 x PDC');
    expect(html).toContain('Squat arriere 105 kg e1RM');
    expect(html).toContain('Ton profil automatique');
    expect(html).toContain('1.24 x PDC');
    expect(html).toContain('Grimpeur');
    expect(html).toContain('Developpe militaire probablement en retard');
    expect(html).toContain('Derniere mesure : 2026-07-07');
    expect(html).toContain('15%');
    expect(html).toContain('id="sport-open-body-measurement"');
  });

  it('renders a fallback chip when loads are missing', () => {
    const html = renderSportProfileDashboard({
      data: { axes: data.axes, weakest: data.weakest, bestLoads: [] },
      latest: null,
      bodyWeightKg: 59,
      api,
    });

    expect(html).toContain('Charges a renseigner dans les series');
    expect(html).toContain('Aucune mesure saisie');
    expect(html).toContain('59 kg');
  });

  it('renders the dated body measurement modal with stable field ids', () => {
    const html = renderBodyMeasurementModal({
      editor: { measured_on: '2026-07-08', weight_kg: 59, body_fat_pct: 14.8, notes: 'matin' },
      api,
    });

    expect(html).toContain('role="dialog"');
    expect(html).toContain('id="sport-body-date"');
    expect(html).toContain('value="2026-07-08"');
    expect(html).toContain('id="sport-body-weight"');
    expect(html).toContain('value="59"');
    expect(html).toContain('id="sport-body-bmi"');
    expect(html).toContain('id="sport-body-fat-mass"');
    expect(html).toContain('id="sport-body-protein-pct"');
    expect(html).toContain('id="sport-body-subfat"');
    expect(html).toContain('id="sport-body-after-toilet"');
    expect(html).toContain('Qualite mesure');
    expect(html).toContain('id="sport-body-save"');
    expect(html).toContain('data-sport-body-close');
    expect(html).toContain('matin');
  });

  it('scores body measurement protocol quality', () => {
    const quality = bodyMeasurementQuality({
      measurement_time: 'morning',
      after_toilet: true,
      before_food: true,
      before_drink: true,
      before_activity: true,
      same_scale: true,
      hard_flat_floor: true,
      dry_feet: true,
    }, api);

    expect(quality.score).toBeGreaterThanOrEqual(88);
    expect(quality.label).toBe('Reference');
  });

  it('renders exercise e1RM progression with a filter', () => {
    const html = renderExerciseProgressionAnalysis({
      selectedExercise: 'barbell_bench_press',
      analysis: {
        selectedExercise: 'barbell_bench_press',
        options: [{ key: 'barbell_bench_press', label: 'barbell_bench_press' }],
        exercises: [{
          key: 'barbell_bench_press',
          label: 'barbell_bench_press',
          first: { date: '2026-07-01', estimated_1rm_kg: 72 },
          last: { date: '2026-07-08', estimated_1rm_kg: 76 },
          best: { date: '2026-07-08', estimated_1rm_kg: 76 },
          delta: 4,
          deltaPct: 5.6,
          rows: [
            { date: '2026-07-01', estimated_1rm_kg: 72 },
            { date: '2026-07-08', estimated_1rm_kg: 76 },
          ],
        }],
      },
      api,
    });

    expect(html).toContain('Analyse progression charges');
    expect(html).toContain('id="sport-progress-exercise"');
    expect(html).toContain('Barbell Bench Press');
    expect(html).toContain('+4 kg');
  });

  it('keeps radar point generation deterministic', () => {
    expect(radarPoints([{ value: 100 }, { value: 50 }, { value: 0 }], 100, 100, 100)).toBe('100,0 143.3,125 100,100');
  });
});
