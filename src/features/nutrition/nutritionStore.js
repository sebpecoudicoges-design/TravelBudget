import { createEntityStore } from '../../data/entityStore.js';

export function createInitialNutritionState() {
  return {
    loaded: false,
    loading: false,
    syncingLocal: false,
    foods: [],
    meals: [],
    items: [],
    sleep: {},
    localRows: [],
    error: '',
    syncStatus: '',
    syncPhase: '',
    foodQuery: '',
    foodCategory: 'all',
    selectedMealType: '',
    selectedDate: '',
    expandedHistory: '',
    editingItemId: '',
  };
}

function cleanArray(value, limit = Infinity) {
  return (Array.isArray(value) ? value : []).slice(0, limit);
}

function cleanSleep(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

export function createNutritionStore(initialState = {}, options = {}) {
  const entityStore = options.entityStore || createEntityStore();
  const namespace = String(options.namespace || 'nutrition');
  const initial = Object.assign(createInitialNutritionState(), initialState);
  entityStore.set(namespace, initial);

  const snapshot = () => entityStore.get(namespace, createInitialNutritionState());
  const replace = (patch) => {
    const next = Object.assign({}, snapshot(), patch || {});
    entityStore.set(namespace, next);
    return next;
  };
  const state = new Proxy({}, {
    get(_target, property) {
      return snapshot()[property];
    },
    set(_target, property, value) {
      replace({ [property]: value });
      return true;
    },
    ownKeys() {
      return Reflect.ownKeys(snapshot());
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  });

  return {
    state,
    entityStore,
    namespace,
    snapshot,
    replace,
    subscribe(listener) {
      return entityStore.subscribe((next, key) => {
        if (key === namespace) listener(next[namespace], key);
      });
    },
    hydrateFoods(foods) {
      return replace({ foods: cleanArray(foods, 900) });
    },
    hydrateRemote({ meals = [], items = [], sleep = {} } = {}) {
      return replace({
        meals: cleanArray(meals),
        items: cleanArray(items),
        sleep: cleanSleep(sleep),
        loaded: true,
        loading: false,
        error: '',
      });
    },
    hydrateLocal(rows = []) {
      const clean = cleanArray(rows, 200);
      return replace({
        localRows: clean,
        meals: clean.map(row => row?.meal).filter(Boolean),
        items: clean.map(row => row?.item).filter(Boolean),
        loaded: true,
        loading: false,
      });
    },
    rememberLocalRow(row) {
      const id = String(row?.syncId || row?.meal?.sync_id || row?.meal?.id || row?.item?.id || '');
      const rows = [row].concat(snapshot().localRows.filter(existing => !id || String(existing?.syncId || existing?.meal?.sync_id || existing?.meal?.id || existing?.item?.id || '') !== id));
      replace({ localRows: cleanArray(rows, 200) });
      return row;
    },
    mergeOptimisticRow(row) {
      if (!row?.meal) return snapshot();
      const current = snapshot();
      const meal = Object.assign({}, row.meal, { localOnly: true, offlinePending: true });
      const item = row.item ? Object.assign({}, row.item, { localOnly: true, offlinePending: true }) : null;
      const meals = cleanArray(current.meals).filter(existing => String(existing?.id || '') !== String(meal.id || ''));
      const items = cleanArray(current.items).filter(existing => String(existing?.id || '') !== String(item?.id || ''));
      meals.unshift(meal);
      if (item) items.unshift(item);
      return replace({ meals, items, loaded: true });
    },
    confirmLocalRow(localRow, remoteMeal, remoteItem) {
      const current = snapshot();
      const syncId = String(localRow?.syncId || localRow?.meal?.sync_id || localRow?.meal?.id || '');
      const localMealId = String(localRow?.meal?.id || '');
      const localItemId = String(localRow?.item?.id || '');
      const meal = Object.assign({}, localRow?.meal || {}, remoteMeal || {}, {
        localOnly: false,
        offlinePending: false,
      });
      const item = remoteItem || localRow?.item ? Object.assign({}, localRow?.item || {}, remoteItem || {}, {
        meal_id: meal.id || remoteItem?.meal_id || localRow?.item?.meal_id,
        localOnly: false,
        offlinePending: false,
      }) : null;
      const obsoleteMealIds = new Set();
      const meals = cleanArray(current.meals).filter(existing => {
        const id = String(existing?.id || '');
        const existingSync = String(existing?.sync_id || '');
        const obsolete = id === localMealId || id === String(meal.id || '') || (syncId && existingSync === syncId);
        if (obsolete && id) obsoleteMealIds.add(id);
        return !obsolete;
      });
      const items = cleanArray(current.items).filter(existing => {
        const id = String(existing?.id || '');
        const mealId = String(existing?.meal_id || '');
        return id !== localItemId
          && id !== String(item?.id || '')
          && mealId !== localMealId
          && mealId !== String(meal.id || '')
          && !obsoleteMealIds.has(mealId);
      });
      meals.unshift(meal);
      if (item) items.unshift(item);
      return replace({ meals, items, loaded: true });
    },
    setSelectedDate(date) {
      const day = String(date || '').slice(0, 10);
      return replace({ selectedDate: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '' });
    },
    setUiState(patch = {}) {
      const allowed = ['foodQuery', 'foodCategory', 'selectedMealType', 'expandedHistory', 'editingItemId', 'syncStatus', 'syncPhase', 'error'];
      return replace(Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(patch, key)).map(key => [key, patch[key]])));
    },
    selectedRows(day, toDay = value => String(value || '').slice(0, 10)) {
      const targetDay = String(day || snapshot().selectedDate || '').slice(0, 10);
      const meals = snapshot().meals.filter(row => toDay(row?.meal_date) === targetDay);
      const mealIds = new Set(meals.map(row => String(row?.id || '')).filter(Boolean));
      const items = snapshot().items.filter(row => row && mealIds.has(String(row.meal_id || '')));
      return { meals, items };
    },
    resetAccountScope() {
      return replace(createInitialNutritionState());
    },
    appSnapshot() {
      const current = snapshot();
      return {
        nutritionMeals: cleanArray(current.meals),
        nutritionMealItems: cleanArray(current.items),
        nutritionFoods: cleanArray(current.foods),
        nutritionSleep: cleanSleep(current.sleep),
      };
    },
  };
}
