import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('persistent contextual help contract', () => {
  const helpers = fs.readFileSync('public/legacy/js/01_helpers.js', 'utf8');
  const theme = fs.readFileSync('src/ui/premium-theme.css', 'utf8');

  it('replaces short-lived native title tooltips with a persistent accessible trigger', () => {
    expect(helpers).toContain('data-tb-help-text="${t}"');
    expect(helpers).toContain('aria-expanded="false"');
    expect(helpers).not.toContain('class="tb-help" title=');
    expect(helpers).toContain('function installPersistentHelpPopover()');
    expect(helpers).toContain('if (event.key === "Escape") close()');
  });

  it('keeps the popover responsive and theme-aware', () => {
    expect(theme).toContain('.tb-help-popover');
    expect(theme).toContain('width: min(320px, calc(100vw - 20px))');
    expect(theme).toContain('body.theme-dark .tb-help-popover');
  });
});
