import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../public/legacy/js/45_sport_ui.js', import.meta.url), 'utf8');

describe('sport program legacy bridge contract', () => {
  it.each([
    'saveSportProgram',
    'nextMondayISO',
    'activateMassProgram',
  ])('keeps the %s helper defined while the program UI still calls it', (name) => {
    expect(source).toMatch(new RegExp(`function\\s+${name}\\s*\\(`));
  });

  it('keeps the default Force/Hypertrophy program as a template without hard-coded loads', () => {
    expect(source).toContain('name: "FORCE A - Squat / Bench / Tractions"');
    expect(source).toContain('name: "HYPERTROPHIE C - Jambes / Push / Pull"');
    expect(source).toContain('templateOnly: true');
    expect(source).not.toContain('programReps("Squat arriere", "barbell", 3, 6, 10, 180, { weightKg: 75 })');
    expect(source).not.toContain('programReps("Souleve de terre", "barbell", 3, 4, 6, 240, { weightKg: 125 })');
  });
});
