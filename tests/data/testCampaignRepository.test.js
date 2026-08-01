import { describe, expect, it, vi } from 'vitest';
import { createTestCampaignRepository } from '../../src/data/testCampaignRepository.js';

function query(result) {
  const chain = new Proxy({}, {
    get(_target, key) {
      if (key === 'then') return (resolve) => Promise.resolve(result).then(resolve);
      return () => chain;
    },
  });
  return chain;
}

describe('test campaign repository', () => {
  it('upserts a tester-owned scenario result', async () => {
    const from = vi.fn(() => query({ data: { id: 'result-1', status: 'ok' }, error: null }));
    const repository = createTestCampaignRepository({ from });
    const saved = await repository.saveScenarioResult({
      campaignId: 'campaign-1', scenarioId: 'scenario-1', userId: 'user-1', status: 'ok', notes: 'valid',
    });
    expect(saved).toMatchObject({ id: 'result-1', status: 'ok' });
    expect(from).toHaveBeenCalledWith('app_test_results');
  });
});
