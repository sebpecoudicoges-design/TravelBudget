import { campaignProgress, moduleProgress, normalizeModuleReviewStatus, normalizeTestStatus } from './testCampaignRules.js';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

function statusLabel(status) {
  if (status === 'ok') return 'OK';
  if (status === 'not_ok') return 'Pas OK';
  return 'A faire';
}

function reviewLabel(status) {
  if (status === 'completed_ok') return 'Termine OK';
  if (status === 'completed_with_issues') return 'Termine avec problemes';
  return 'En cours';
}

export function renderCampaignEmpty() {
  return `<div class="tb-ui-state tb-ui-state--empty" role="status"><strong>Aucune campagne active</strong><span>Une campagne sera affichee ici des qu elle sera ouverte.</span></div>`;
}

export function renderCampaignError(message) {
  return `<div class="tb-ui-state tb-ui-state--error" role="alert"><strong>Campagne indisponible</strong><span>${esc(message || 'Reessaie dans quelques instants.')}</span></div>`;
}

export function renderTestCampaign(state, options = {}) {
  const modules = state?.modules || [];
  const campaign = state?.campaign;
  if (!campaign) return renderCampaignEmpty();
  const selectedId = String(options.selectedModuleId || modules[0]?.id || '');
  const selected = modules.find((item) => String(item.id) === selectedId) || modules[0];
  const total = campaignProgress(modules);
  const progress = moduleProgress(selected);
  const reviewStatus = normalizeModuleReviewStatus(selected?.review?.status);

  return `<div class="tb-test-campaign" data-test-campaign-id="${esc(campaign.id)}">
    <section class="tb-test-hero">
      <div>
        <span class="tb-test-kicker">Campagne ${esc(campaign.app_version || '')}</span>
        <h2>${esc(campaign.title)}</h2>
        <p>${esc(campaign.description || '')}</p>
      </div>
      <div class="tb-test-total" aria-label="Progression generale">
        <strong>${total.percent}%</strong>
        <span>${total.completed}/${total.total} tests · ${total.issues} probleme(s)</span>
      </div>
    </section>

    <div class="tb-test-layout">
      <nav class="tb-test-modules" aria-label="Modules a tester">
        ${modules.map((module) => {
          const itemProgress = moduleProgress(module);
          const itemReview = normalizeModuleReviewStatus(module?.review?.status);
          return `<button type="button" class="tb-test-module ${String(module.id) === String(selected?.id) ? 'is-active' : ''}" data-test-module="${esc(module.id)}">
            <span><strong>${esc(module.title)}</strong><small>${esc(reviewLabel(itemReview))}</small></span>
            <b>${itemProgress.completed}/${itemProgress.total}</b>
          </button>`;
        }).join('')}
      </nav>

      <section class="tb-test-workspace" data-test-module-workspace="${esc(selected?.id || '')}">
        <header class="tb-test-module-head">
          <div>
            <span class="tb-test-kicker">${esc(reviewLabel(reviewStatus))}</span>
            <h3>${esc(selected?.title || '')}</h3>
            <p>${esc(selected?.description || '')}</p>
          </div>
          <button type="button" class="btn" data-test-open-module="${esc(selected?.module_key || '')}">${selected?.module_key === 'project' ? 'Ouvrir la page Projet' : 'Ouvrir le module'}</button>
        </header>
        <div class="tb-test-instructions"><strong>Instructions generales</strong><span>${esc(selected?.instructions || 'Realise les scenarios dans l ordre et note tout ecart observe.')}</span></div>
        <div class="tb-test-progress"><span style="width:${progress.percent}%"></span></div>

        <div class="tb-test-scenarios">
          ${(selected?.scenarios || []).map((scenario, index) => {
            const status = normalizeTestStatus(scenario?.result?.status);
            return `<article class="tb-test-scenario is-${esc(status)}" data-test-scenario="${esc(scenario.id)}">
              <header><span>${index + 1}</span><div><h4>${esc(scenario.title)}</h4><small>${esc(statusLabel(status))}${scenario.required === false ? ' · facultatif' : ''}</small></div></header>
              <p>${esc(scenario.instructions)}</p>
              <div class="tb-test-expected"><strong>Resultat attendu</strong><span>${esc(scenario.expected_result)}</span></div>
              <div class="tb-test-actions" role="group" aria-label="Resultat du test">
                <button type="button" class="btn ${status === 'ok' ? 'primary' : ''}" data-test-result="ok">OK</button>
                <button type="button" class="btn ${status === 'not_ok' ? 'danger' : ''}" data-test-result="not_ok">Pas OK</button>
                <button type="button" class="btn" data-test-result="pending">A refaire</button>
              </div>
              <label class="tb-test-note">Notes
                <textarea rows="3" data-test-notes placeholder="Appareil, resultat reel, erreur console, capture...">${esc(scenario?.result?.notes || '')}</textarea>
              </label>
              <button type="button" class="btn tb-test-save-note" data-test-save-note>Enregistrer la note</button>
            </article>`;
          }).join('')}
        </div>

        <footer class="tb-test-finish">
          <label>Note generale du module
            <textarea rows="3" data-test-module-notes placeholder="Resume du test et points a reprendre...">${esc(selected?.review?.notes || '')}</textarea>
          </label>
          <div class="tb-test-finish-actions">
            <button type="button" class="btn primary" data-test-finish="completed_ok">Terminer : tout est OK</button>
            <button type="button" class="btn danger" data-test-finish="completed_with_issues">Terminer avec problemes</button>
          </div>
          <div class="tb-test-feedback" data-test-feedback role="status"></div>
        </footer>
      </section>
    </div>
  </div>`;
}
