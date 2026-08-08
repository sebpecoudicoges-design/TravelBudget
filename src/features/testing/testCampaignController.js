import { createTestCampaignRepository } from '../../data/testCampaignRepository.js';
import { buildCampaignState, filterCampaignModules, validateModuleCompletion } from './testCampaignRules.js';
import { renderCampaignError, renderTestCampaign } from './testCampaignView.js';

let campaignState = null;
let selectedModuleId = '';
let boundRoot = null;
let moduleFilter = 'active';
let showArchived = false;

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
  root.innerHTML = renderTestCampaign(campaignState, { selectedModuleId, moduleFilter, showArchived });
}

async function reload(root) {
  const repository = createTestCampaignRepository(getClient());
  const payload = await repository.loadActiveCampaign(getUserId());
  campaignState = payload ? buildCampaignState(payload) : { campaign: null, modules: [] };
  const visibleModules = filterCampaignModules(campaignState.modules, moduleFilter);
  if (!selectedModuleId || !visibleModules.some((item) => String(item.id) === String(selectedModuleId))) {
    const firstIncomplete = visibleModules.find((item) => !String(item?.review?.status || '').startsWith('completed'));
    selectedModuleId = String(firstIncomplete?.id || visibleModules[0]?.id || '');
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

async function appendScenarioFeedback(root, card) {
  const scenarioId = card?.dataset?.testScenario;
  const scenario = currentModule()?.scenarios?.find((item) => String(item.id) === String(scenarioId));
  if (!scenario || scenario.closed_at) return;
  try {
    const repository = createTestCampaignRepository(getClient());
    await repository.appendScenarioFeedback({ scenarioId });
    await reload(root);
    feedback(root, 'Nouveau retour ajoute a la suite de l historique.');
  } catch (error) {
    feedback(root, error?.message || String(error), true);
  }
}

async function closeScenario(root, card) {
  const scenarioId = card?.dataset?.testScenario;
  const scenario = currentModule()?.scenarios?.find((item) => String(item.id) === String(scenarioId));
  if (!scenario?.result?.id || campaignState?.viewerRole !== 'admin') return;
  if (!window.confirm('Clore ce test pour tous les testeurs ? Son historique restera visible.')) return;
  try {
    const repository = createTestCampaignRepository(getClient());
    await repository.closeScenarioGlobally({
      scenarioId,
      treatedVersion: campaignState.campaign.app_version,
      treatmentNotes: 'Retour relu, traite et clos pour tous les testeurs.',
    });
    await reload(root);
    feedback(root, 'Test clos pour tous les testeurs.');
  } catch (error) {
    feedback(root, error?.message || String(error), true);
  }
}

async function archiveReview(root) {
  const module = currentModule();
  if (!module?.review?.id) return;
  try {
    const repository = createTestCampaignRepository(getClient());
    await repository.archiveModuleReview({
      reviewId: module.review.id,
      userId: getUserId(),
      treatedVersion: campaignState.campaign.app_version,
      treatmentNotes: 'Relecture du module traitee.',
    });
    await reload(root);
    feedback(root, 'Relecture du module archivee.');
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
    const appendFeedback = event.target.closest('[data-test-add-feedback]');
    if (appendFeedback) {
      await appendScenarioFeedback(root, appendFeedback.closest('[data-test-scenario]'));
      return;
    }
    const closeResult = event.target.closest('[data-test-close-result]');
    if (closeResult) {
      await closeScenario(root, closeResult.closest('[data-test-scenario]'));
      return;
    }
    const archiveReviewButton = event.target.closest('[data-test-archive-review]');
    if (archiveReviewButton) {
      await archiveReview(root);
      return;
    }
    const finish = event.target.closest('[data-test-finish]');
    if (finish) await finishModule(root, finish.dataset.testFinish);
  });
  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-test-module-filter]')) {
      moduleFilter = event.target.value || 'active';
      const visible = filterCampaignModules(campaignState?.modules || [], moduleFilter);
      selectedModuleId = String(visible[0]?.id || '');
      render(root);
      return;
    }
    if (event.target.matches('[data-test-show-archived]')) {
      showArchived = !!event.target.checked;
      render(root);
    }
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
