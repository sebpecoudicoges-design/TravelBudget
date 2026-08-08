import { describe, expect, it } from 'vitest';
import {
  buildCampaignState,
  campaignProgress,
  filterCampaignModules,
  moduleNeedsTesting,
  moduleProgress,
  validateModuleCompletion,
} from '../../../src/features/testing/testCampaignRules.js';

function moduleWith(statuses) {
  return {
    id: 'module-1',
    scenarios: statuses.map((status, index) => ({
      id: `scenario-${index}`,
      required: true,
      result: { status },
    })),
    review: { status: 'in_progress' },
  };
}

describe('test campaign rules', () => {
  it('joins scenarios, results and reviews by stable ids', () => {
    const state = buildCampaignState({
      campaign: { id: 'campaign-1' },
      modules: [{ id: 'module-1' }],
      scenarios: [{ id: 'scenario-1', module_id: 'module-1' }],
      results: [{ scenario_id: 'scenario-1', status: 'ok', notes: 'done' }],
      reviews: [{ module_id: 'module-1', status: 'completed_ok' }],
    });
    expect(state.modules[0].scenarios[0].result).toMatchObject({ status: 'ok', notes: 'done' });
    expect(state.modules[0].review.status).toBe('completed_ok');
  });

  it('computes progress and prevents an invalid module completion', () => {
    expect(moduleProgress(moduleWith(['ok', 'pending']))).toMatchObject({ completed: 1, total: 2, percent: 50, canComplete: false });
    expect(validateModuleCompletion(moduleWith(['ok', 'pending']), 'completed_ok').ok).toBe(false);
    expect(validateModuleCompletion(moduleWith(['ok', 'not_ok']), 'completed_ok').ok).toBe(false);
    expect(validateModuleCompletion(moduleWith(['ok', 'not_ok']), 'completed_with_issues').ok).toBe(true);
    expect(validateModuleCompletion(moduleWith(['ok', 'ok']), 'completed_ok').ok).toBe(true);
  });

  it('aggregates the campaign without hiding issues', () => {
    expect(campaignProgress([moduleWith(['ok', 'not_ok']), moduleWith(['pending'])])).toMatchObject({
      completed: 2,
      total: 3,
      issues: 1,
      percent: 67,
    });
  });

  it('keeps archived test cycles while exposing only the active retest result', () => {
    const state = buildCampaignState({
      campaign: { id: 'campaign-1' },
      modules: [{ id: 'module-1' }, { id: 'module-archived', archived_at: '2026-08-01T10:00:00Z' }],
      scenarios: [{ id: 'scenario-1', module_id: 'module-1' }],
      results: [
        { id: 'old', scenario_id: 'scenario-1', status: 'not_ok', completed_at: '2026-08-01T09:00:00Z', archived_at: '2026-08-01T10:00:00Z' },
        { id: 'retest', scenario_id: 'scenario-1', status: 'pending', archived_at: null },
      ],
    });
    expect(state.modules[0].scenarios[0].result.id).toBe('retest');
    expect(state.modules[0].scenarios[0].archives).toHaveLength(1);
    expect(moduleNeedsTesting(state.modules[0])).toBe(true);
    expect(filterCampaignModules(state.modules, 'todo')).toHaveLength(1);
    expect(filterCampaignModules(state.modules, 'archived')[0].id).toBe('module-archived');
  });

  it('classifies a module with only treated archives as having no test to perform', () => {
    const state = buildCampaignState({
      modules: [{ id: 'module-1' }],
      scenarios: [{ id: 'scenario-1', module_id: 'module-1' }],
      results: [{ id: 'old', scenario_id: 'scenario-1', status: 'ok', archived_at: '2026-08-01T10:00:00Z' }],
    });
    expect(state.modules[0].scenarios[0].testRequired).toBe(false);
    expect(moduleNeedsTesting(state.modules[0])).toBe(false);
    expect(filterCampaignModules(state.modules, 'no_tests')).toHaveLength(1);
  });

  it('keeps feedback lineage and closes a scenario for every viewer', () => {
    const state = buildCampaignState({
      viewerRole: 'admin',
      modules: [{ id: 'module-1' }],
      scenarios: [
        { id: 'parent', module_id: 'module-1', title: 'Objectif' },
        { id: 'child', module_id: 'module-1', title: 'Retest', parent_scenario_id: 'parent', closed_at: '2026-08-08T05:00:00Z' },
      ],
      results: [
        { id: 'first', scenario_id: 'child', status: 'not_ok', sequence_no: 1, superseded_at: '2026-08-08T04:00:00Z' },
        { id: 'second', scenario_id: 'child', status: 'ok', sequence_no: 2 },
      ],
    });
    const child = state.modules[0].scenarios[1];
    expect(child.parentScenarioTitle).toBe('Objectif');
    expect(child.result.id).toBe('second');
    expect(child.archives[0].id).toBe('first');
    expect(child.testRequired).toBe(false);
    expect(state.viewerRole).toBe('admin');
  });
});
