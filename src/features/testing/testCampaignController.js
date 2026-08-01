import { createTestCampaignRepository } from '../../data/testCampaignRepository.js';
import { buildCampaignState, validateModuleCompletion } from './testCampaignRules.js';
import { renderCampaignError, renderTestCampaign } from './testCampaignView.js';

let campaignState = null;
let selectedModuleId = '';
let boundRoot = null;

function getClient() {
  return window.__TB_SB__ || window.sb;
}

function getUserId() {
  return window.sbUser?.id || '';
}

function currentModule() {
  return campaignState?.modules?.find((item) => String(item.id) === String(selectedModuleId)) || campaignState?.modules?.[0] || null;
}

function feedback(root, message, isError = false) {
  const box = root.querySelector('[data-test-feedback]');
  if (!box) return;
  box.textContent = message || '';
  box.classList.toggle('is-error', !!isError);
}

function render(root) {
  root.innerHTML = renderTestCampaign(campaignState, { selectedModuleId });
}

async function reload(root) {
  const repository = createTestCampaignRepository(getClient());
  const payload = await repository.loadActiveCampaign(getUserId());
  campaignState = payload ? buildCampaignState(payload) : { campaign: null, modules: [] };
  if (!selectedModuleId || !campaignState.modules.some((item) => String(item.id) === String(selectedModuleId))) {
    const firstIncomplete = campaignState.modules.find((item) => !String(item?.review?.status || '').startsWith('completed'));
    selectedModuleId = String(firstIncomplete?.id || campaignState.modules[0]?.id || '');
  }
  render(root);
}

async function saveScenario(root, card, status) {
  const module = currentModule();
  const scenarioId = card?.dataset?.testScenario;
  const scenario = module?.scenarios?.find((item) => String(item.id) === String(scenarioId));
  if (!scenario) return;
  const notes = card.querySelector('[data-test-notes]')?.value || '';
  const repository = createTestCampaignRepository(getClient());
  card.classList.add('is-saving');
  try {
    const saved = await repository.saveScenarioResult({
      campaignId: campaignState.campaign.id,
      scenarioId,
      userId: getUserId(),
      status,
      notes,
    });
    scenario.result = saved || { status, notes };
    render(root);
  } catch (error) {
    card.classList.remove('is-saving');
    feedback(root, error?.message || String(error), true);
  }
}

async function finishModule(root, status) {
  const module = currentModule();
  if (!module) return;
  const validation = validateModuleCompletion(module, status);
  if (!validation.ok) return feedback(root, validation.message, true);
  const notes = root.querySelector('[data-test-module-notes]')?.value || '';
  try {
    const repository = createTestCampaignRepository(getClient());
    module.review = await repository.saveModuleReview({
      campaignId: campaignState.campaign.id,
      moduleId: module.id,
      userId: getUserId(),
      status,
      notes,
    });
    const next = campaignState.modules.find((item) => String(item?.review?.status || 'in_progress') === 'in_progress' && String(item.id) !== String(module.id));
    if (next) selectedModuleId = String(next.id);
    render(root);
    feedback(root, status === 'completed_ok' ? 'Module termine OK.' : 'Module termine avec problemes. Les notes sont enregistrees.');
  } catch (error) {
    feedback(root, error?.message || String(error), true);
  }
}

function bind(root) {
  if (boundRoot === root) return;
  boundRoot = root;
  root.addEventListener('click', async (event) => {
    const moduleButton = event.target.closest('[data-test-module]');
    if (moduleButton) {
      selectedModuleId = moduleButton.dataset.testModule;
      render(root);
      return;
    }
    const openButton = event.target.closest('[data-test-open-module]');
    if (openButton) {
      const target = openButton.dataset.testOpenModule;
      if (target === 'project') {
        window.open('/projet.html', '_blank', 'noopener');
        return;
      }
      if (target && typeof window.showView === 'function') window.showView(target);
      return;
    }
    const resultButton = event.target.closest('[data-test-result]');
    if (resultButton) {
      await saveScenario(root, resultButton.closest('[data-test-scenario]'), resultButton.dataset.testResult);
      return;
    }
    const saveNote = event.target.closest('[data-test-save-note]');
    if (saveNote) {
      const card = saveNote.closest('[data-test-scenario]');
      const scenarioId = card?.dataset?.testScenario;
      const scenario = currentModule()?.scenarios?.find((item) => String(item.id) === String(scenarioId));
      await saveScenario(root, card, scenario?.result?.status || 'pending');
      return;
    }
    const finish = event.target.closest('[data-test-finish]');
    if (finish) await finishModule(root, finish.dataset.testFinish);
  });
}

export async function renderTestCampaignApp(reason = 'navigation') {
  const root = document.getElementById('testing-root');
  if (!root) return;
  bind(root);
  root.innerHTML = '<div class="tb-ui-state tb-ui-state--loading" role="status"><strong>Chargement de la campagne...</strong></div>';
  try {
    await reload(root);
  } catch (error) {
    root.innerHTML = renderCampaignError(error?.message || String(error));
    try { console.error('[TB][testing] campaign load failed', reason, error); } catch (_) {}
  }
}
