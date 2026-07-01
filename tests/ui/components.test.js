import { describe, expect, it } from 'vitest';
import { stateMessage } from '../../src/ui/components.js';

describe('shared UI components', () => {
  it('renders known states and escapes user-facing text', () => {
    const html = stateMessage({ kind: 'error', title: '<Erreur>', message: 'A&B' });
    expect(html).toContain('tb-ui-state--error');
    expect(html).toContain('&lt;Erreur&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).not.toContain('<Erreur>');
  });
});
