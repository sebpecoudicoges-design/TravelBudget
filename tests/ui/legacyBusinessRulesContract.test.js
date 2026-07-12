import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('legacy business rules contract', () => {
  it('keeps the no-new-business-rules rule documented and guarded', () => {
    const checklist = fs.readFileSync('docs/V11_REFACTOR_CHECKLIST.md', 'utf8');
    const files = fs.readdirSync('public/legacy/js').filter((file) => file.endsWith('.js'));

    expect(checklist).toContain('- [x] Ne plus ajouter de nouvelle regle metier dans `public/legacy/js`.');
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = fs.readFileSync(`public/legacy/js/${file}`, 'utf8');
      expect(source, file).not.toContain('export function');
      expect(source, file).not.toContain('export const');
    }
  });
});
