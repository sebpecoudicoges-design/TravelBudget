import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('work domain extraction contract', () => {
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const work = fs.readFileSync('public/legacy/js/47_work_ui.js', 'utf8');
  const career = fs.readFileSync('public/legacy/js/50_work_career_ui.js', 'utf8');
  const view = fs.readFileSync('src/features/work/workView.js', 'utf8');

  it('exposes the Work view module and pure rules to legacy', () => {
    expect(bridge).toContain("import * as workRules from '../core/workRules.js'");
    expect(bridge).toContain("import * as workView from '../features/work/workView.js'");
    expect(bridge).toContain('window.Core.workRules = workRules');
    expect(bridge).toContain('window.UI.workView = workView');
  });

  it('delegates Work visuals and career timeline to workView', () => {
    expect(work).toContain('window.UI?.workView?.renderWorkLoadPanel');
    expect(career).toContain('window.UI?.workView?.renderWorkCareerPanel');
    expect(career).toContain('window.Core?.workRules?.summarizeWorkCareer');
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
  });
});
