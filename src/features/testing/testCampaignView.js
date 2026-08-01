import {
  campaignProgress,
  filterCampaignModules,
  moduleNeedsTesting,
  moduleProgress,
  normalizeModuleReviewStatus,
  normalizeTestStatus,
} from './testCampaignRules.js';

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

function dateLabel(value) {
  if (!value) return 'Non renseignee';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function renderArchive(archive, title) {
  const archiveStatus = archive.module_id ? reviewLabel(archive.status) : statusLabel(archive.status);
  return `<article class="tb-test-archive" data-test-archive-id="${esc(archive.id)}">
    <header><div><strong>${esc(title)}</strong><small>${esc(archiveStatus)}</small></div><span>Archive traitee</span></header>
    <dl>
      <div><dt>Test effectue</dt><dd>${esc(dateLabel(archive.completed_at || archive.updated_at))}</dd></div>
      <div><dt>Traite</dt><dd>${esc(dateLabel(archive.treated_at))}</dd></div>
      <div><dt>Version</dt><dd>${esc(archive.treated_version || 'Non renseignee')}</dd></div>
    </dl>
    ${archive.notes ? `<p><strong>Note du testeur</strong>${esc(archive.notes)}</p>` : ''}
    ${archive.treatment_notes ? `<p><strong>Traitement</strong>${esc(archive.treatment_notes)}</p>` : ''}
  </article>`;
}

export function renderCampaignEmpty() {
  return `<div class="tb-ui-state tb-ui-state--empty" role="status"><strong>Aucune campagne active</strong><span>Une campagne sera affichee ici des qu elle sera ouverte.</span></div>`;
}

export function renderCampaignError(message) {
  return `<div class="tb-ui-state tb-ui-state--error" role="alert"><strong>Campagne indisponible</strong><span>${esc(message || 'Reessaie dans quelques instants.')}</span></div>`;
}

export function renderTestCampaign(state, options = {}) {
  const allModules = state?.modules || [];
  const campaign = state?.campaign;
  if (!campaign) return renderCampaignEmpty();
  const moduleFilter = options.moduleFilter || 'active';
  const modules = filterCampaignModules(allModules, moduleFilter);
  const showArchived = !!options.showArchived || moduleFilter === 'archived';
  const selectedId = String(options.selectedModuleId || modules[0]?.id || '');
  const selected = modules.find((item) => String(item.id) === selectedId) || modules[0] || null;
  const total = campaignProgress(allModules);
  const progress = moduleProgress(selected);
  const reviewStatus = normalizeModuleReviewStatus(selected?.review?.status);
  const activeScenarios = (selected?.scenarios || []).filter((scenario) => scenario.testRequired !== false);
  const scenarioArchives = (selected?.scenarios || []).flatMap((scenario) => (
    (scenario.archives || []).map((archive) => ({ ...archive, scenarioTitle: scenario.title }))
  ));

  return `<div class="tb-test-campaign" data-test-campaign-id="${esc(campaign.id)}">
    <section class="tb-test-hero">
      <div>
        <span class="tb-test-kicker">Campagne ${esc(campaign.app_version || '')}</span>
        <h2>${esc(campaign.title)}</h2>
        <p>${esc(campaign.description || '')}</p>
      </div>
      <div class="tb-test-total" aria-label="Progression generale">
        <strong>${total.percent}%</strong>
        <span>${total.completed}/${total.total} tests actifs · ${total.issues} probleme(s)</span>
      </div>
    </section>

    <section class="tb-test-filters" aria-label="Filtres de campagne">
      <label>Modules
        <select data-test-module-filter>
          <option value="active"${moduleFilter === 'active' ? ' selected' : ''}>Tous les modules actifs</option>
          <option value="todo"${moduleFilter === 'todo' ? ' selected' : ''}>Tests a effectuer</option>
          <option value="no_tests"${moduleFilter === 'no_tests' ? ' selected' : ''}>Sans test a effectuer</option>
          <option value="archived"${moduleFilter === 'archived' ? ' selected' : ''}>Modules archives</option>
        </select>
      </label>
      <label class="tb-test-archive-toggle"><input type="checkbox" data-test-show-archived${showArchived ? ' checked' : ''}${moduleFilter === 'archived' ? ' disabled' : ''}> Afficher les tests archives</label>
    </section>

    ${selected ? `<div class="tb-test-layout">
      <nav class="tb-test-modules" aria-label="Modules a tester">
        ${modules.map((module) => {
          const itemProgress = moduleProgress(module);
          const itemReview = normalizeModuleReviewStatus(module?.review?.status);
          const stateLabel = module.archived_at ? 'Archive' : moduleNeedsTesting(module) ? reviewLabel(itemReview) : 'Sans test a effectuer';
          return `<button type="button" class="tb-test-module ${String(module.id) === String(selected?.id) ? 'is-active' : ''}" data-test-module="${esc(module.id)}">
            <span><strong>${esc(module.title)}</strong><small>${esc(stateLabel)}</small></span>
            <b>${itemProgress.completed}/${itemProgress.total}${itemProgress.archived ? ` · ${itemProgress.archived} arch.` : ''}</b>
          </button>`;
        }).join('')}
      </nav>

      <section class="tb-test-workspace" data-test-module-workspace="${esc(selected?.id || '')}">
        <header class="tb-test-module-head">
          <div>
            <span class="tb-test-kicker">${esc(selected.archived_at ? 'Module archive' : reviewLabel(reviewStatus))}</span>
            <h3>${esc(selected?.title || '')}</h3>
            <p>${esc(selected?.description || '')}</p>
            ${selected.archived_at ? `<small>Archive le ${esc(dateLabel(selected.archived_at))} · ${esc(selected.archive_reason || '')}</small>` : ''}
          </div>
          ${selected.archived_at ? '' : `<button type="button" class="btn" data-test-open-module="${esc(selected?.module_key || '')}">${selected?.module_key === 'project' ? 'Ouvrir la page Projet' : 'Ouvrir le module'}</button>`}
        </header>
        ${selected.archived_at ? '' : `<div class="tb-test-instructions"><strong>Instructions generales</strong><span>${esc(selected?.instructions || 'Realise les scenarios dans l ordre et note tout ecart observe.')}</span></div>
        <div class="tb-test-progress"><span style="width:${progress.percent}%"></span></div>`}

        <div class="tb-test-scenarios">
          ${activeScenarios.map((scenario, index) => {
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
              <div class="tb-test-save-row">
                <button type="button" class="btn tb-test-save-note" data-test-save-note>Enregistrer la note</button>
                ${scenario?.result?.id && status !== 'pending' ? '<button type="button" class="btn" data-test-archive-result>Archiver comme traite</button>' : ''}
              </div>
              ${scenario?.result?.completed_at ? `<small class="tb-test-date">Test effectue le ${esc(dateLabel(scenario.result.completed_at))}</small>` : ''}
            </article>`;
          }).join('') || (selected.archived_at ? '' : '<div class="tb-ui-state tb-ui-state--empty"><strong>Aucun test a effectuer</strong><span>Les tests traites restent disponibles avec le filtre des archives.</span></div>')}
        </div>

        ${showArchived && scenarioArchives.length ? `<section class="tb-test-archives"><h4>Tests archives</h4>${scenarioArchives.map((archive) => renderArchive(archive, archive.scenarioTitle)).join('')}</section>` : ''}
        ${showArchived && selected.reviewArchives?.length ? `<section class="tb-test-archives"><h4>Relectures de module archivees</h4>${selected.reviewArchives.map((archive) => renderArchive(archive, selected.title)).join('')}</section>` : ''}

        ${selected.archived_at ? '' : `<footer class="tb-test-finish">
          <label>Note generale du module
            <textarea rows="3" data-test-module-notes placeholder="Resume du test et points a reprendre...">${esc(selected?.review?.notes || '')}</textarea>
          </label>
          <div class="tb-test-finish-actions">
            <button type="button" class="btn primary" data-test-finish="completed_ok">Terminer : tout est OK</button>
            <button type="button" class="btn danger" data-test-finish="completed_with_issues">Terminer avec problemes</button>
            ${selected?.review?.id && reviewStatus !== 'in_progress' ? '<button type="button" class="btn" data-test-archive-review>Archiver le module traite</button>' : ''}
          </div>
          <div class="tb-test-feedback" data-test-feedback role="status"></div>
        </footer>`}
      </section>
    </div>` : '<div class="tb-ui-state tb-ui-state--empty"><strong>Aucun module dans ce filtre</strong><span>Choisis un autre filtre pour poursuivre la campagne.</span></div>'}
  </div>`;
}
