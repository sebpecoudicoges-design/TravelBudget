import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('syntax lint contract', () => {
  it('keeps a non-formatting syntax lint command in the quality workflow', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const script = fs.readFileSync('scripts/check-js-syntax.mjs', 'utf8');

    expect(pkg.scripts['lint:syntax']).toBe('node scripts/check-js-syntax.mjs');
    expect(script).toContain("process.execPath, ['--check', file]");
    expect(script).toContain("'public/legacy/js/42_assets_ui.js'");
    expect(script).not.toContain('--write');
  });
});
