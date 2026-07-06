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
});
