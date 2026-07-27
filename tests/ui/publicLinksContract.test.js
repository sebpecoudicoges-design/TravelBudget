import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('public release links contract', () => {
  it('keeps a Play Store readiness link checker wired into npm scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const script = readFileSync('scripts/check-public-links.mjs', 'utf8');
    const checklist = readFileSync('docs/PROJECT_PAGE_CHECKLIST.md', 'utf8');

    expect(pkg.scripts['links:check']).toBe('node scripts/check-public-links.mjs');
    expect(script).toContain('public/projet.html');
    expect(script).toContain('public/privacy.html');
    expect(script).toContain('fetchWithTimeout');
    expect(script).toContain('Liens publics OK');
    expect(checklist).toContain('vérification automatique des liens publics');
  });
});
