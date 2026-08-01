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

  it('labels the public project page action explicitly', () => {
    const html = renderTestCampaign({
      campaign: { id: 'campaign-1', title: 'Interface', app_version: '10.5.318' },
      modules: [{
        id: 'module-project', module_key: 'project', title: 'Interface generale', instructions: 'Review',
        scenarios: [], review: { status: 'in_progress', notes: '' },
      }],
    });

    expect(html).toContain('data-test-open-module="project"');
    expect(html).toContain('Ouvrir la page Projet');
  });

  it('renders module and archive filters with test and treatment dates', () => {
    const html = renderTestCampaign({
      campaign: { id: 'campaign-1', title: 'Tests', app_version: '10.5.319' },
      modules: [{
        id: 'module-1', module_key: 'dashboard', title: 'Dashboard',
        scenarios: [{
          id: 'scenario-1', title: 'Chargement', instructions: 'Ouvrir', expected_result: 'Visible', required: true,
          testRequired: false, result: { status: 'pending' },
          archives: [{ id: 'archive-1', status: 'not_ok', completed_at: '2026-08-01T09:00:00Z', treated_at: '2026-08-01T10:00:00Z', treated_version: '10.5.319' }],
        }],
        review: { status: 'in_progress' }, reviewArchives: [],
      }],
    }, { showArchived: true, moduleFilter: 'no_tests' });
    expect(html).toContain('data-test-module-filter');
    expect(html).toContain('data-test-show-archived');
    expect(html).toContain('Sans test a effectuer');
    expect(html).toContain('Test effectue');
    expect(html).toContain('Traite');
    expect(html).toContain('10.5.319');
  });
});
