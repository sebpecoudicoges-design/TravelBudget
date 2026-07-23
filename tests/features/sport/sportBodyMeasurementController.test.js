import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBodyMeasurementEditor,
  ensureBodyMeasurementsLoaded,
  latestBodyMeasurement,
  readBodyMeasurementFromDom,
  saveBodyMeasurement,
  saveBodyMeasurementsLocal,
} from '../../../src/features/sport/sportBodyMeasurementController.js';

function installLocalStorage() {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  });
}

function bodyRoot(values = {}) {
  return {
    querySelector(selector) {
      const id = selector.replace('#', '');
      if (id in values) return values[id];
      return { value: '', checked: false };
    },
  };
}

describe('Sport body measurement controller', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installLocalStorage();
  });

  it('keeps latest measurement and caps local history', () => {
    const rows = Array.from({ length: 90 }, (_, index) => ({
      measured_on: `2026-06-${String((index % 28) + 1).padStart(2, '0')}`,
      source: 'impedance_scale',
      weight_kg: index,
    }));
    const cache = {};
    const saved = saveBodyMeasurementsLocal(rows, { storageKey: 'body', cache });
    expect(saved).toHaveLength(80);
    expect(cache.bodyMeasurements).toHaveLength(80);
    expect(latestBodyMeasurement([{ measured_on: '2026-06-01' }, { measured_on: '2026-06-30' }])).toMatchObject({ measured_on: '2026-06-30' });
  });

  it('builds an editor from a selected row, latest row and body weight fallback', () => {
    expect(buildBodyMeasurementEditor({
      today: '2026-07-23',
      weightKg: 59,
      latest: { weight_kg: 60, body_fat_pct: 15 },
    })).toMatchObject({
      measured_on: '2026-07-23',
      weight_kg: 60,
      body_fat_pct: 15,
      measurement_time: 'morning',
      after_toilet: true,
    });
  });

  it('reads body measurement fields and quality from DOM', () => {
    const payload = readBodyMeasurementFromDom({
      today: '2026-07-23',
      userId: 'u1',
      qualityFn: () => ({ score: 7, label: 'moyenne' }),
      root: bodyRoot({
        'sport-body-date': { value: '2026-07-22' },
        'sport-body-weight': { value: '59,5' },
        'sport-body-fat': { value: '14.2' },
        'sport-body-type': { value: ' Lean athletic ' },
        'sport-body-vma': { value: '15.5' },
        'sport-body-after-toilet': { checked: true },
      }),
    });
    expect(payload).toMatchObject({
      user_id: 'u1',
      measured_on: '2026-07-22',
      weight_kg: 59.5,
      body_fat_pct: 14.2,
      body_type: 'Lean athletic',
      vma_kmh: 15.5,
      vma_source: 'measured',
      protocol_quality_score: 7,
      protocol_quality_label: 'moyenne',
    });
  });

  it('saves locally when no client is available', async () => {
    const cache = { bodyMeasurements: [] };
    const onWeight = vi.fn();
    const result = await saveBodyMeasurement({
      cache,
      storageKey: 'body',
      today: '2026-07-23',
      onWeight,
      root: bodyRoot({
        'sport-body-date': { value: '2026-07-23' },
        'sport-body-weight': { value: '59' },
      }),
    });
    expect(result).toMatchObject({ ok: true, mode: 'local' });
    expect(cache.bodyMeasurements).toHaveLength(1);
    expect(onWeight).toHaveBeenCalledWith(59);
  });

  it('loads remote rows once and stores them locally', async () => {
    const cache = {};
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(async () => ({ data: [{ measured_on: '2026-07-20', source: 'impedance_scale' }] })),
    };
    const client = { from: vi.fn(() => chain) };
    const loaded = await ensureBodyMeasurementsLoaded({
      cache,
      client,
      userId: 'u1',
      storageKey: 'body',
      columns: 'id,measured_on',
    });
    expect(loaded).toBe(true);
    expect(client.from).toHaveBeenCalledWith('health_body_measurements');
    expect(cache.bodyMeasurements).toHaveLength(1);
    expect(cache.bodyMeasurementsLoaded).toBe(true);
  });
});
