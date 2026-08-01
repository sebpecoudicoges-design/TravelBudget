export const TEST_RESULT_STATUSES = Object.freeze(['pending', 'ok', 'not_ok']);
export const MODULE_REVIEW_STATUSES = Object.freeze(['in_progress', 'completed_ok', 'completed_with_issues']);

export function normalizeTestStatus(status) {
  return TEST_RESULT_STATUSES.includes(status) ? status : 'pending';
}

export function normalizeModuleReviewStatus(status) {
  return MODULE_REVIEW_STATUSES.includes(status) ? status : 'in_progress';
}

export function buildCampaignState(payload = {}) {
  const resultsByScenario = new Map((payload.results || []).map((row) => [String(row.scenario_id), row]));
  const reviewsByModule = new Map((payload.reviews || []).map((row) => [String(row.module_id), row]));
  const scenariosByModule = new Map();
  for (const scenario of payload.scenarios || []) {
    const key = String(scenario.module_id || '');
    if (!scenariosByModule.has(key)) scenariosByModule.set(key, []);
    scenariosByModule.get(key).push({
      ...scenario,
      result: resultsByScenario.get(String(scenario.id)) || { status: 'pending', notes: '' },
    });
  }
  const modules = (payload.modules || []).map((module) => ({
    ...module,
    scenarios: scenariosByModule.get(String(module.id)) || [],
    review: reviewsByModule.get(String(module.id)) || { status: 'in_progress', notes: '' },
  }));
  return { campaign: payload.campaign || null, modules };
}

export function moduleProgress(module) {
  const scenarios = Array.isArray(module?.scenarios) ? module.scenarios : [];
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
  };
}

export function campaignProgress(modules = []) {
  const totals = modules.reduce((acc, module) => {
    const progress = moduleProgress(module);
    acc.total += progress.total;
    acc.completed += progress.completed;
    acc.issues += progress.issues;
    if (normalizeModuleReviewStatus(module?.review?.status) !== 'in_progress') acc.modulesCompleted += 1;
    return acc;
  }, { total: 0, completed: 0, issues: 0, modulesCompleted: 0 });
  return {
    ...totals,
    modulesTotal: modules.length,
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
