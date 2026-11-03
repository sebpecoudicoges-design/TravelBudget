import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const bootstrap=fs.readFileSync('public/legacy/js/07_supabase_bootstrap.js','utf8');
const settings=fs.readFileSync('public/legacy/js/14_settings_periods_ui.js','utf8');
it('keeps a single public first-setup implementation without an overwritten fallback',()=>{
  expect(bootstrap.match(/function showFirstTimeWizardModal\(/g)).toHaveLength(1);
  expect(bootstrap).not.toMatch(/showFirstTimeWizardModal\s*=\s*function/);
  expect(bootstrap).not.toContain('function upperCurrencyInput(');
  expect(bootstrap).toContain('return await showFirstTimeWizardModal(defaults)');
});
it.each([['fr','Activités'],['en','Activities']])('translates the accented activity category in %s', (lang,expected)=>{
  const expression=settings.match(/const postLabel = ([\s\S]*?);/)[1];
  const label=vm.runInNewContext(expression,{rt:(fr,en)=>lang==='en'?en:fr});
  expect(label('Activités')).toBe(expected);
  expect(label('Activites')).toBe(lang==='en'?'Activities':'Activites');
  expect(label('Unknown')).toBe('Unknown');
});
