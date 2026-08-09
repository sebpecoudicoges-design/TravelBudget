import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('work domain extraction contract', () => {
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  const work = fs.readFileSync('public/legacy/js/47_work_ui.js', 'utf8');
  const career = fs.readFileSync('public/legacy/js/50_work_career_ui.js', 'utf8');
  const view = fs.readFileSync('src/features/work/workView.js', 'utf8');

  it('exposes Work rules at boot and lazy-loads the Work view before the domain legacy scripts', () => {
    expect(bridge).toContain("import * as workRules from '../core/workRules.js'");
    expect(bridge).toContain('window.Core.workRules = workRules');
    expect(bridge).not.toContain("import * as workView from '../features/work/workView.js'");
    expect(main).toContain("import('./features/work/workView.js')");
    expect(main).toContain('window.UI.workView');
  });

  it('delegates Work visuals and career timeline to workView', () => {
    expect(work).toContain('window.UI?.workView?.renderWorkLoadPanel');
    expect(career).toContain('window.UI?.workView?.renderWorkCareerPanel');
    expect(career).toContain('window.Core?.workRules?.summarizeWorkCareer');
    expect(career).toContain("table('documents')");
    expect(career).toContain('window.tbDocumentsPreview');
    expect(career).toContain('window.tbDocumentsSelectFolder');
  });

  it('keeps missions, income, periods and visual workload in the extracted view surface', () => {
    expect(view).toContain('renderWorkLoadPanel');
    expect(view).toContain('renderWorkCareerPanel');
    expect(view).toContain('summarizeWorkWeek');
    expect(view).toContain('todayWorkLabel');
    expect(view).toContain('data-career-open="job"');
    expect(view).toContain('data-career-open="income"');
    expect(view).toContain('data-career-open="status"');
    expect(view).toContain('data-career-link-folder');
    expect(career).toContain('data-career-open-document');
    expect(career).toContain('data-career-upload-folder');
  });

  it('keeps language refresh and prevents the removed Work BMR field from returning', () => {
    expect(work).toContain('window.tbOnLangChange.push');
    expect(work).not.toContain('id="work-bmr"');
    expect(work).not.toContain('function bodyBmr');
    expect(work).not.toContain('function baseline');
  });

  it('keeps Work panels on adaptive light and dark aliases', () => {
    expect(career).toContain('background:var(--panel2)');
    expect(career).toContain('background:var(--panel)');
    expect(career).not.toContain('background:var(--tb-surface');
    expect(career).not.toContain('border:1px solid var(--tb-line');
  });
});
