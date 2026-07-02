import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('work career modal migration', () => {
  const source = fs.readFileSync('public/legacy/js/50_work_career_ui.js', 'utf8');

  it('uses the shared accessible modal for all career forms', () => {
    expect(source).toContain("window.UI?.createModal?.({");
    expect(source).toContain("id:'tb-work-career-modal'");
    expect(source).toContain('data-career-form="${kind}"');
    expect(source).toContain('role="alert"');
  });

  it('does not recreate a career-specific backdrop or modal shell', () => {
    expect(source).not.toContain('tb-career-modal-bg');
    expect(source).not.toContain('tb-career-modal-head');
    expect(source).not.toContain('tb-career-modal-actions');
  });
});
