import { describe, expect, it } from 'vitest';
import { renderTestCampaign } from '../../../src/features/testing/testCampaignView.js';

describe('test campaign view', () => {
  it('renders instructions, decisions, notes and module completion controls', () => {
    const html = renderTestCampaign({
      campaign: { id: 'campaign-1', title: '<Campaign>', description: 'Test', app_version: '10.5.316' },
      modules: [{
        id: 'module-1', module_key: 'dashboard', title: 'Dashboard', instructions: 'Start here',
        scenarios: [{ id: 'scenario-1', title: '<Load>', instructions: 'Open', expected_result: 'Works', required: true, result: { status: 'not_ok', notes: '<bug>' } }],
        review: { status: 'in_progress', notes: '' },
      }],
    });
    expect(html).toContain('&lt;Campaign&gt;');
    expect(html).toContain('&lt;Load&gt;');
    expect(html).toContain('&lt;bug&gt;');
    expect(html).toContain('data-test-result="ok"');
    expect(html).toContain('data-test-result="not_ok"');
    expect(html).toContain('data-test-save-note');
    expect(html).toContain('data-test-finish="completed_ok"');
    expect(html).toContain('data-test-open-module="dashboard"');
  });
});
