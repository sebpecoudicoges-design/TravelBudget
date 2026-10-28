import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectJavaScriptFiles, checkJavaScriptSyntax } from '../../scripts/check-js-syntax.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

describe('syntax lint coverage', () => {
  it('includes shipped legacy, worker, server and configuration scripts', () => {
    const files = collectJavaScriptFiles().map((file) => path.relative(process.cwd(), file).replaceAll('\\', '/'));
    expect(files).toEqual(expect.arrayContaining([
      'public/legacy/js/29_trip_v1.js', 'public/legacy/js/42_assets_ui.js',
      'public/sw.js', 'vite.config.js', 'vitest.config.js',
      'playwright.config.mjs', 'scripts/lint_db_strings.cjs',
      'supabase/functions/assistant-help/handler.js',
      'supabase/functions/assistant-help/index.ts',
      'supabase/functions/_shared/account-data.ts',
    ]));
    expect(files.some((file) => file.startsWith('netlify/functions/'))).toBe(true);
    expect(files.some((file) => /^(node_modules|dist|android)\//.test(file))).toBe(false);
  });

  it('rejects invalid classic scripts without executing or changing source files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-syntax-'));
    roots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    fs.mkdirSync(path.join(root, 'public/legacy/js'), { recursive: true });
    fs.mkdirSync(path.join(root, 'netlify/functions'), { recursive: true });
    fs.mkdirSync(path.join(root, 'supabase/functions/test'), { recursive: true });
    const sources = {
      'public/legacy/js/broken.js': 'function broken( {',
      'netlify/functions/valid.cjs': 'throw new Error("must not execute");',
      'config.mjs': 'export default {};',
      'supabase/functions/test/index.ts': 'const user: string = ;',
      'supabase/functions/test/valid.ts': 'import { x } from "https://example.invalid/not-fetched.ts"; const id: string = "test"; Deno.serve(() => { throw new Error(id); });',
      'supabase/functions/test/handler.js': 'export function handler( {',
    };
    for (const [file, source] of Object.entries(sources)) fs.writeFileSync(path.join(root, file), source);
    const { files, failures } = checkJavaScriptSyntax(root);
    expect(files).toHaveLength(6);
    expect(failures.map(({ file }) => file.replaceAll('\\', '/'))).toEqual([
      'public/legacy/js/broken.js',
      'supabase/functions/test/handler.js',
      'supabase/functions/test/index.ts',
    ]);
    for (const [file, source] of Object.entries(sources)) expect(fs.readFileSync(path.join(root, file), 'utf8')).toBe(source);
  });
});
