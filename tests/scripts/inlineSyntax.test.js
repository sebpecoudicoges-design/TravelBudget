import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectHtmlFiles, inlineSources, checkInlineSyntax } from '../../scripts/check-inline-syntax.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
function check(html) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-inline-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'index.html'), html);
  const result = checkInlineSyntax(root);
  expect(fs.readFileSync(path.join(root, 'index.html'), 'utf8')).toBe(html);
  return result;
}

it('covers root and public HTML, including nested pages, without build outputs', () => {
  const files = collectHtmlFiles().map(file => path.relative(process.cwd(), file).replaceAll('\\', '/'));
  expect(files).toEqual(expect.arrayContaining(['index.html', 'public/projet.html', 'public/offline.html', 'public/showcase/index.html']));
  expect(files.some(file => /^(dist|android|node_modules)\//.test(file))).toBe(false);
});

it('uses HTML parsing for comments, quoted attributes, entities and non-JavaScript data', () => {
  const html = `<!-- <script>broken(</script> --><script type="application/ld+json">{"x":1}</script>
    <script src="remote.js">ignored(</script><div data-onclick="broken(" title=">" onclick="return &quot;ok&quot;;"></div>
    <script data-label=">">throw new Error('must not execute');</script>`;
  expect(inlineSources(html).map(source => source.kind)).toEqual(['handler', 'script']);
  expect(check(html).failures).toEqual([]);
});

it('checks module syntax without fetching imports or executing top-level code', () => {
  const result = check('<script type="module">import x from "https://example.invalid/no-request.js"; await x(); throw new Error("not executed");</script>');
  expect(result.count).toBe(1);
  expect(result.failures).toEqual([]);
});

it('reports all broken blocks and their HTML locations', () => {
  const result = check('<script>const x = ;</script>\n<div onclick="return (;"></div>\n<script type="module">export const y = ;</script>');
  expect(result.failures.map(({ file, line, kind }) => ({ file, line, kind }))).toEqual([
    { file: 'index.html', line: 1, kind: 'script' },
    { file: 'index.html', line: 2, kind: 'onclick' },
    { file: 'index.html', line: 3, kind: 'script' },
  ]);
});

it('distinguishes classic scripts from handler bodies and modules', () => {
  expect(check('<script>return 1;</script>').failures).toHaveLength(1);
  expect(check('<button onclick="return false;"></button>').failures).toEqual([]);
  expect(check('<script>export const value = 1;</script>').failures).toHaveLength(1);
});

it('checks scripts inside templates and legacy JavaScript MIME types', () => {
  expect(check('<template><script type="text/javascript">broken(</script></template>').failures).toHaveLength(1);
  expect(check('<script language="javascript">broken(</script>').failures).toHaveLength(1);
});
