import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('work career modal migration', () => {
  const source = fs.readFileSync('public/legacy/js/50_work_career_ui.js', 'utf8');
  const linkMigration = fs.readFileSync('supabase/migrations/20260809023152_extend_work_document_links_10_5_333.sql', 'utf8');

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

  it('allows exactly one Work owner per linked document folder', () => {
    expect(linkMigration).toContain('income_event_id uuid');
    expect(linkMigration).toContain('status_period_id uuid');
    expect(linkMigration).toContain('num_nonnulls(engagement_id, income_event_id, status_period_id) = 1');
    expect(linkMigration).toContain('work_document_folders_income_folder_uidx');
    expect(linkMigration).toContain('work_document_folders_status_folder_uidx');
  });
});
