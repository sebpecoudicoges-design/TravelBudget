import { describe, expect, it } from 'vitest';
import {
  buildCampaignState,
  campaignProgress,
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
});
