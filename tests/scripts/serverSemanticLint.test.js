import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkServerSemantics } from '../../scripts/check-server-semantics.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
function fixture(sources = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-server-lint-')); roots.push(root);
  for (const [name, source] of Object.entries(sources)) {
    const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, source);
  }
  return root;
}
it('rejects dead calculations, browser globals and unsafe finally in both server trees', () => {
  const root = fixture({
    'supabase/functions/_shared/nested/handler.ts': 'export function read(value: number) { const total=value*2; return window.location; }',
    'netlify/functions/handler.mjs': 'export function load() { try { return unknownService(); } finally { return true; } }',
  });
  const result = checkServerSemantics(root);
  expect(result.ok).toBe(false);
  for (const rule of ['no-unused-vars', 'no-window', 'no-undef', 'no-unsafe-finally']) expect(result.output).toContain(rule);
});
it('checks TS and JS without executing handlers or resolving remote imports', () => {
  const result = checkServerSemantics(fixture({
    'supabase/functions/index.ts': "import { read } from 'https://example.invalid/never-fetch.ts'; export const run=(id: string)=>read(id); throw new Error('never execute');",
    'netlify/functions/index.js': "export default async ()=>new Response('ok'); throw new Error('never execute');",
  }));
  expect(result.ok, result.output).toBe(true);
  expect(result.files).toHaveLength(2);
});
it('fails closed when either server tree is absent or empty', () => {
  expect(() => checkServerSemantics(fixture())).toThrow();
  const root = fixture({ 'supabase/functions/index.ts': 'export const ok=true;' });
  expect(() => checkServerSemantics(root)).toThrow();
  fs.mkdirSync(path.join(root, 'netlify/functions'), { recursive: true });
  expect(() => checkServerSemantics(root)).toThrow('No JavaScript sources');
});
it('covers every server source and remains mandatory alongside type checks', () => {
  const result = checkServerSemantics(); expect(result.ok, result.output).toBe(true);
  const expected = ['supabase/functions', 'netlify/functions'].flatMap(dir => fs.readdirSync(dir, { recursive: true })
    .filter(file => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)).map(file => path.resolve(dir, file)));
  expect(result.files.sort()).toEqual(expected.sort());
  const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
  expect(scripts.quality.split(' && ')).toEqual(expect.arrayContaining(['npm run lint:server', 'npm run lint:edge']));
  expect(scripts['lint:server']).toBe('node scripts/check-server-semantics.mjs');
});
