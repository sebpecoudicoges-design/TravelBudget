import { expect, it } from 'vitest';
import { staticEntryFiles } from '../../scripts/check-module-budgets.mjs';

it('follows static imports once and excludes even a larger deferred chunk', () => {
  expect(staticEntryFiles({
    'index.html': { file: 'assets/small.js', imports: ['shared'], dynamicImports: ['large'] },
    shared: { file: 'assets/shared.js', imports: ['index.html'] },
    large: { file: 'assets/large.js' },
  })).toEqual(['assets/small.js', 'assets/shared.js']);
});
it('fails explicitly on an incomplete manifest', () => {
  expect(() => staticEntryFiles({ 'index.html': { file: 'assets/app.js', imports: ['missing'] } })).toThrow('Missing manifest chunk');
});
