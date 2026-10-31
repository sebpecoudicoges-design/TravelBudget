import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCoreSemantics } from '../../scripts/check-core-semantics.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
function check(sources) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-core-lint-'));
  roots.push(root);
  for (const [name, source] of Object.entries(sources)) {
    const file = path.join(root, 'src/core', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
  return checkCoreSemantics(root);
}

it('rejects unknown variables, duplicate keys, dead code, unsafe finally and unused calculations', () => {
  const cases = {
    'unknown.js': 'export const balance = missingAmount + 1;',
    'keys.js': 'export const row = { amount: 10, amount: 20 };',
    'dead.js': 'export function amount() { return 1; throw new Error(); }',
    'finally.js': 'export function save() { try { throw new Error(); } finally { return true; } }',
    'unused.js': 'const unused = 1; export const amount = 2;',
    'nested/browser.js': 'export const value = window.currentBalance;',
  };
  const result = check(cases);
  expect(result.ok).toBe(false);
  expect(result.files).toHaveLength(6);
  const diagnostics = JSON.parse(result.output).diagnostics;
  expect(diagnostics.map(item => item.code)).toEqual(expect.arrayContaining([
    'no-undef', 'no-dupe-keys', 'no-unreachable', 'no-unsafe-finally', 'no-unused-vars', 'no-window',
  ]));
});

it('accepts pure rules and explicit omitted fields without executing code or resolving imports', () => {
  const result = check({ 'rule.js': `import { amount } from 'https://example.invalid/never-fetch.js';
    export function payload({ itemIndex: _itemIndex, ...row }, _compatibilityParameter) { return { ...row, amount }; }
    export const url = new URL('https://example.invalid');
    throw new Error('must not execute');` });
  expect(result.ok, result.output).toBe(true);
});

it('rejects untagged line suppression and stale suppression comments', () => {
  const result = check({ 'blanket.js': '// deno-lint-ignore\nexport const amount = missingAmount;',
    'stale.js': '// deno-lint-ignore no-undef\nexport const amount = 2;' });
  expect(result.ok).toBe(false);
  expect(JSON.parse(result.output).diagnostics.map(item => item.code)).toEqual(expect.arrayContaining(['ban-untagged-ignore', 'ban-unused-ignore']));
});

it('covers all current core modules and is mandatory in the quality chain', () => {
  const result = checkCoreSemantics();
  expect(result.ok, result.output).toBe(true);
  expect(result.files.map(file => path.basename(file)).sort()).toEqual(fs.readdirSync('src/core').filter(name => name.endsWith('.js')).sort());
  const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
  expect(scripts.quality.split(' && ')).toContain('npm run lint:core');
  expect(scripts['lint:core']).toBe('node scripts/check-core-semantics.mjs');
});
