import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const source = fs.readFileSync('supabase/functions/dispatch-mobile-notifications/index.ts', 'utf8');
// Load only local code; no imported client and no handler execution or notification sending.
const localSource = source.replace(/^import .*;\r?\n/gm, '');
const health = vm.runInNewContext(`${stripTypeScriptTypes(localSource)}\nhealthTemplateValues`, {
  Deno: { serve() {} },
});

it.each([
  { weight: 70, protein: 112, kcal: 1648.75 },
  { weight: 35, protein: 70, kcal: 1298.75 },
])('preserves maintenance targets and score for weight $weight', async ({ weight, protein, kcal }) => {
  const data = {
    settings: { body_weight_kg: weight, body_height_cm: 175, birth_date: '1996-10-29' },
    nutrition_sleep: { hours: 8 },
    nutrition_meals: [{ water_ml: 2000, nutrition_meal_items: [{ kcal, protein_g: protein }] }],
  };
  const admin = { from(table) {
    return { select() { return this; }, eq() { return this; }, maybeSingle() { return this; },
      then(resolve) { resolve({ data: data[table] }); } };
  } };
  const result = await health(admin, 'synthetic-user', '2026-10-29', 12, { sportKcal: 0, workKcal: 0 });
  expect(result['/kcalobjectif']).toBe(`${Math.round(kcal)} kcal`);
  expect(result['/scoreSante']).toBe('88/100');
  expect(result['/kcalrestantesjour']).toBe('0 kcal');
});

it('does not restore unreachable bulk/cut branches under a constant maintenance mode', () => {
  const body = source.slice(source.indexOf('async function healthTemplateValues'), source.indexOf('async function plannedSessionLabel'));
  expect(body).not.toContain('const mode = "maintenance"');
  expect(body).not.toMatch(/mode === "(?:bulk|cut)"/);
});
