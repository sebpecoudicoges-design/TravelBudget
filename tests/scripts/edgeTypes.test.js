import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectEdgeTypeScript, checkEdgeTypes } from '../../scripts/check-edge-types.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

it('includes every deployed function and shared TypeScript module', () => {
  const files = collectEdgeTypeScript().map(file => path.relative(process.cwd(), file).replaceAll('\\', '/'));
  expect(files).toContain('supabase/functions/_shared/account-data.ts');
  for (const entry of fs.readdirSync('supabase/functions', { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))) {
    expect(files).toContain(`supabase/functions/${entry.name}/index.ts`);
  }
});

it.each([true, false])('checks types without executing handlers (valid=%s)', valid => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-edge-types-'));
  roots.push(root);
  const dir = path.join(root, 'supabase/functions/test');
  fs.mkdirSync(dir, { recursive: true });
  const source = `const amount: number = ${valid ? '1' : '"wrong"'}; throw new Error("MUST_NOT_EXECUTE");`;
  const file = path.join(dir, 'index.ts');
  fs.writeFileSync(file, source);
  const result = checkEdgeTypes(root);
  expect(result.ok, result.output).toBe(valid);
  if (!valid) expect(result.output).toContain('TS2322');
  expect(fs.readFileSync(file, 'utf8')).toBe(source);
}, 30000);
