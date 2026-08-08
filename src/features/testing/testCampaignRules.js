export const TEST_RESULT_STATUSES = Object.freeze(['pending', 'ok', 'not_ok']);
export const MODULE_REVIEW_STATUSES = Object.freeze(['in_progress', 'completed_ok', 'completed_with_issues']);

export function normalizeTestStatus(status) {
  return TEST_RESULT_STATUSES.includes(status) ? status : 'pending';
}

export function normalizeModuleReviewStatus(status) {
  return MODULE_REVIEW_STATUSES.includes(status) ? status : 'in_progress';
}

export function buildCampaignState(payload = {}) {
  const scenarioById = new Map((payload.scenarios || []).map((row) => [String(row.id), row]));
  const resultsByScenario = new Map();
  for (const row of payload.results || []) {
    const key = String(row.scenario_id);
    if (!resultsByScenario.has(key)) resultsByScenario.set(key, []);
    resultsByScenario.get(key).push(row);
  }
  const reviewsByModule = new Map();
  for (const row of payload.reviews || []) {
    const key = String(row.module_id);
    if (!reviewsByModule.has(key)) reviewsByModule.set(key, []);
    reviewsByModule.get(key).push(row);
  }
  const scenariosByModule = new Map();
  for (const scenario of payload.scenarios || []) {
    const key = String(scenario.module_id || '');
    if (!scenariosByModule.has(key)) scenariosByModule.set(key, []);
    const rows = (resultsByScenario.get(String(scenario.id)) || [])
      .sort((a, b) => Number(b.sequence_no || 0) - Number(a.sequence_no || 0)
        || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const activeResult = rows.find((row) => !row.archived_at && !row.superseded_at);
    const archives = rows.filter((row) => row.id !== activeResult?.id);
    const parentScenario = scenarioById.get(String(scenario.parent_scenario_id || ''));
    scenariosByModule.get(key).push({
      ...scenario,
      parentScenarioTitle: parentScenario?.title || '',
      result: activeResult || { status: 'pending', notes: '' },
      archives,
      testRequired: !scenario.closed_at && (!!activeResult || archives.length === 0),
    });
  }
  const modules = (payload.modules || []).map((module) => {
    const reviews = reviewsByModule.get(String(module.id)) || [];
    return {
      ...module,
      scenarios: scenariosByModule.get(String(module.id)) || [],
      review: reviews.find((row) => !row.archived_at) || { status: 'in_progress', notes: '' },
      reviewArchives: reviews.filter((row) => !!row.archived_at)
        .sort((a, b) => String(b.archived_at).localeCompare(String(a.archived_at))),
    };
  });
  return { campaign: payload.campaign || null, modules, viewerRole: payload.viewerRole || '' };
}

export function moduleProgress(module) {
  const allScenarios = Array.isArray(module?.scenarios) ? module.scenarios : [];
  const scenarios = allScenarios.filter((item) => item.testRequired !== false);
  const required = scenarios.filter((item) => item.required !== false);
  const completed = scenarios.filter((item) => normalizeTestStatus(item?.result?.status) !== 'pending');
  const requiredCompleted = required.filter((item) => normalizeTestStatus(item?.result?.status) !== 'pending');
  const issues = scenarios.filter((item) => normalizeTestStatus(item?.result?.status) === 'not_ok');
  return {
    total: scenarios.length,
    required: required.length,
    completed: completed.length,
    requiredCompleted: requiredCompleted.length,
    issues: issues.length,
    percent: scenarios.length ? Math.round((completed.length / scenarios.length) * 100) : 0,
    canComplete: requiredCompleted.length === required.length,
    archived: allScenarios.reduce((count, item) => count + (item.archives?.length || 0), 0),
  };
}

export function moduleNeedsTesting(module) {
  if (module?.archived_at) return false;
  return (module?.scenarios || []).some((scenario) => (
    scenario.testRequired !== false && normalizeTestStatus(scenario?.result?.status) === 'pending'
  ));
}

export function filterCampaignModules(modules = [], mode = 'active') {
  if (mode === 'archived') return modules.filter((module) => !!module.archived_at);
  const active = modules.filter((module) => !module.archived_at);
  if (mode === 'todo') return active.filter(moduleNeedsTesting);
  if (mode === 'no_tests') return active.filter((module) => !moduleNeedsTesting(module));
  return active;
}

export function campaignProgress(modules = []) {
  const activeModules = modules.filter((module) => !module?.archived_at);
  const totals = activeModules.reduce((acc, module) => {
    const progress = moduleProgress(module);
    acc.total += progress.total;
    acc.completed += progress.completed;
    acc.issues += progress.issues;
    if (normalizeModuleReviewStatus(module?.review?.status) !== 'in_progress') acc.modulesCompleted += 1;
    return acc;
  }, { total: 0, completed: 0, issues: 0, modulesCompleted: 0 });
  return {
    ...totals,
    modulesTotal: activeModules.length,
    percent: totals.total ? Math.round((totals.completed / totals.total) * 100) : 0,
  };
}

export function validateModuleCompletion(module, targetStatus) {
  const progress = moduleProgress(module);
  if (!progress.canComplete) return { ok: false, message: 'Reponds a tous les scenarios obligatoires avant de terminer ce module.' };
  if (targetStatus === 'completed_ok' && progress.issues > 0) {
    return { ok: false, message: 'Ce module contient au moins un resultat Pas OK. Termine-le avec problemes ou corrige les resultats.' };
  }
  if (targetStatus === 'completed_with_issues' && progress.issues === 0) {
    return { ok: false, message: 'Aucun scenario Pas OK n est enregistre pour ce module.' };
  }
  return { ok: true, message: '' };
}
