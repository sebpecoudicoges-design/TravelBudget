const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function itemIndexOf(set) {
  return Math.max(0, Math.round(numberValue(set?.itemIndex, 0)));
}

export function normalizeSandboxSetIndexes(doneSets = []) {
  const counters = new Map();
  return (doneSets || []).map((set) => {
    const itemIndex = itemIndexOf(set);
    const next = (counters.get(itemIndex) || 0) + 1;
    counters.set(itemIndex, next);
    return Object.assign({}, set, { itemIndex, setIndex: next });
  });
}

export function syncSandboxPlanSetCounts(plan = [], doneSets = []) {
  return (plan || []).map((item, itemIndex) => {
    const count = (doneSets || []).filter((set) => itemIndexOf(set) === itemIndex).length;
    return Object.assign({}, item, { sets: count });
  });
}

export function removeSandboxSet({ plan = [], doneSets = [], index = 0 } = {}) {
  const nextSets = (doneSets || []).filter((_, idx) => idx !== Math.max(0, Math.round(numberValue(index, 0))));
  const normalizedSets = normalizeSandboxSetIndexes(nextSets);
  return {
    plan: syncSandboxPlanSetCounts(plan, normalizedSets),
    doneSets: normalizedSets,
  };
}

export function buildSandboxSetForExercise({
  plan = [],
  doneSets = [],
  itemIndex = 0,
  weightKg = 0,
  now = new Date().toISOString(),
  api = {},
} = {}) {
  const n = api.numberValue || numberValue;
  const setWorkSeconds = api.setWorkSeconds || (() => 0);
  const supportsExternalLoad = api.supportsExternalLoad || (() => false);
  const lastLoadForExercise = api.lastLoadForExercise || (() => 0);
  const effectiveLoadKg = api.effectiveLoadKg || (() => 0);
  const normalizedItemIndex = Math.max(0, Math.round(n(itemIndex, 0)));
  const item = plan[normalizedItemIndex] || plan[0] || {};
  const existingSets = (doneSets || []).filter((set) => itemIndexOf(set) === normalizedItemIndex);
  const nextSetIndex = Math.max(0, ...existingSets.map((set) => Math.round(n(set.setIndex, 0)))) + 1;
  return {
    itemIndex: normalizedItemIndex,
    setIndex: nextSetIndex,
    id: null,
    itemId: existingSets.find((set) => set?.itemId)?.itemId || null,
    reps: item.mode === 'reps' ? n(item.targetReps, 0) : null,
    durationSeconds: setWorkSeconds(item),
    weightKg: supportsExternalLoad(item) ? lastLoadForExercise(item, effectiveLoadKg(item, weightKg)) : 0,
    distanceM: n(item.distanceM, 0),
    completedAt: now,
  };
}

export function addSandboxSetToExercise({
  plan = [],
  doneSets = [],
  itemIndex = 0,
  weightKg = 0,
  now = new Date().toISOString(),
  api = {},
} = {}) {
  const newSet = buildSandboxSetForExercise({ plan, doneSets, itemIndex, weightKg, now, api });
  const insertAt = (doneSets || []).reduce((last, set, idx) => (
    itemIndexOf(set) === newSet.itemIndex ? idx : last
  ), -1);
  const nextSets = (doneSets || []).slice();
  nextSets.splice(insertAt >= 0 ? insertAt + 1 : nextSets.length, 0, newSet);
  const normalizedSets = normalizeSandboxSetIndexes(nextSets);
  const nextPlan = syncSandboxPlanSetCounts(plan, normalizedSets).map((item, idx) => (
    idx === newSet.itemIndex
      ? Object.assign({}, item, { sets: Math.max(Math.round(numberValue(item?.sets, 1)), newSet.setIndex) })
      : item
  ));
  return {
    plan: nextPlan,
    doneSets: normalizedSets,
    addedSet: normalizedSets.find((set) => set.completedAt === newSet.completedAt && itemIndexOf(set) === newSet.itemIndex) || newSet,
    item: plan[newSet.itemIndex] || plan[0] || {},
  };
}
