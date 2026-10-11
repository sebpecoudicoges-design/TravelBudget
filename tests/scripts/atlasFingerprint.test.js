import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fingerprintTextFiles } from '../../scripts/generate-project-atlas.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

it('keeps the Atlas fingerprint stable across checkout line endings, but detects source changes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-atlas-'));
  roots.push(root);
  const source = 'export const amount = 10;\nexport const currency = "EUR";\n';
  const file = path.join(root, 'source.js');
  fs.writeFileSync(file, source);
  const baseline = fingerprintTextFiles(root, ['source.js']);
  fs.writeFileSync(file, source.replaceAll('\n', '\r\n'));
  expect(fingerprintTextFiles(root, ['source.js'])).toBe(baseline);
  fs.writeFileSync(file, source.replace('10', '20'));
  expect(fingerprintTextFiles(root, ['source.js'])).not.toBe(baseline);
});
