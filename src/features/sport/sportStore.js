import { createEntityStore } from '../../data/entityStore.js';

export function createInitialSportState() {
  return {
    loaded: false,
    loading: false,
    error: '',
    status: '',
    sessions: [],
    items: [],
    sets: [],
    localSessions: [],
    pendingDeletes: [],
    plan: [],
    timer: null,
    pendingSummary: null,
    wakeLock: null,
    localScope: '',
    builderGoal: 'strength',
    builderEquipment: 'all',
    builderDuration: 35,
    builderLevel: 'regular',
    builderFamily: 'all',
    timerFocus: false,
    timerBeepVolume: 70,
    savingWorkoutKeys: new Set(),
    exerciseSearch: '',
    globalRestSeconds: 60,
    circuit: {},
    program: {},
    sqlSessionFavorites: [],
    programLoading: false,
    programLoaded: false,
    programSource: 'fallback',
    editingPlanIndex: null,
    sessionEditor: null,
    bodyMeasurements: [],
    bodyMeasurementEditor: null,
    bodyMeasurementsLoading: false,
    bodyMeasurementsLoaded: false,
    libraryLoaded: false,
    libraryLoading: false,
    librarySource: 'fallback',
  };
}

function cleanArray(value, limit = Infinity) {
  return (Array.isArray(value) ? value : []).slice(0, limit);
}

function uniqueIds(rows, limit = 80) {
  return Array.from(new Set(cleanArray(rows).map(String).filter(Boolean))).slice(0, limit);
}

function workoutMatches(row, id) {
  const key = String(id || '');
  return String(row?.localId || row?.id || '') === key || String(row?.remoteId || '') === key;
}

export function createSportStore(initialState = {}, options = {}) {
  const entityStore = options.entityStore || createEntityStore();
  const namespace = String(options.namespace || 'sport');
  const initial = Object.assign(createInitialSportState(), initialState);
  entityStore.set(namespace, initial);

  const snapshot = () => entityStore.get(namespace, createInitialSportState());
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
    hydrateScope(scope = {}) {
      return replace({
        localScope: String(scope.localScope || ''),
        localSessions: cleanArray(scope.localSessions, 50),
        pendingDeletes: uniqueIds(scope.pendingDeletes),
        plan: cleanArray(scope.plan, 80),
      });
    },
    hydrateOffline(appState = {}) {
      return replace({
        sessions: cleanArray(appState.sportSessions),
        items: cleanArray(appState.sportSessionItems),
        sets: cleanArray(appState.sportSets),
        loaded: true,
        loading: false,
        error: '',
      });
    },
    hydrateRemote(history = {}, pendingDeleteIds = []) {
      const pending = new Set(uniqueIds(pendingDeleteIds));
      const sessions = cleanArray(history.sessions).filter(row => !pending.has(String(row?.id || '')));
      const sessionIds = new Set(sessions.map(row => String(row?.id || '')).filter(Boolean));
      const items = cleanArray(history.items).filter(row => sessionIds.has(String(row?.session_id || '')));
      const itemIds = new Set(items.map(row => String(row?.id || '')).filter(Boolean));
      return replace({
        sessions,
        items,
        sets: cleanArray(history.sets).filter(row => itemIds.has(String(row?.item_id || ''))),
        pendingDeletes: uniqueIds(pendingDeleteIds),
        loaded: true,
        loading: false,
        error: '',
      });
    },
    setPlan(plan) {
      const clean = cleanArray(plan, 80);
      replace({ plan: clean });
      return clean;
    },
    setLocalSessions(rows) {
      const clean = cleanArray(rows, 50);
      replace({ localSessions: clean });
      return clean;
    },
    rememberLocalWorkout(row) {
      const id = String(row?.localId || row?.id || '');
      const rows = [row].concat(snapshot().localSessions.filter(item => !id || String(item?.localId || item?.id || '') !== id));
      this.setLocalSessions(rows);
      return row;
    },
    markLocalSynced(localId, remoteId) {
      const rows = snapshot().localSessions.map(row => String(row?.localId || '') === String(localId || '')
        ? Object.assign({}, row, { localOnly: false, remoteId: remoteId || row.remoteId })
        : row);
      this.setLocalSessions(rows);
      return rows;
    },
    removeWorkout(id) {
      const key = String(id || '');
      const current = snapshot();
      const itemIds = new Set(current.items
        .filter(item => String(item?.session_id || '') === key)
        .map(item => String(item?.id || ''))
        .filter(Boolean));
      return replace({
        localSessions: current.localSessions.filter(row => !workoutMatches(row, key)),
        sessions: current.sessions.filter(row => String(row?.id || '') !== key),
        items: current.items.filter(row => String(row?.session_id || '') !== key),
        sets: current.sets.filter(row => !itemIds.has(String(row?.item_id || ''))),
      });
    },
    updateLocalWorkoutDate(id, date) {
      const key = String(id || '');
      const day = String(date || '').slice(0, 10);
      if (!key || !day) return false;
      let changed = false;
      const rows = snapshot().localSessions.map(row => {
        if (!workoutMatches(row, key)) return row;
        changed = true;
        const oldStart = String(row?.startedAt || row?.started_at || new Date().toISOString());
        const oldEnd = String(row?.endedAt || row?.ended_at || oldStart);
        return Object.assign({}, row, {
          startedAt: `${day}T${oldStart.slice(11, 19) || '00:00:00'}`,
          endedAt: `${day}T${oldEnd.slice(11, 19) || oldStart.slice(11, 19) || '00:00:00'}`,
        });
      });
      if (changed) this.setLocalSessions(rows);
      return changed;
    },
    setPendingDeletes(rows) {
      const clean = uniqueIds(rows);
      replace({ pendingDeletes: clean });
      return clean;
    },
    rememberPendingDelete(id) {
      const key = String(id || '');
      if (!key || key.startsWith('local_')) return snapshot().pendingDeletes;
      return this.setPendingDeletes(snapshot().pendingDeletes.concat(key));
    },
    clearPendingDelete(id) {
      const key = String(id || '');
      return this.setPendingDeletes(snapshot().pendingDeletes.filter(row => row !== key));
    },
    resetAccountScope() {
      return replace({
        loaded: false,
        loading: false,
        error: '',
        status: '',
        sessions: [],
        items: [],
        sets: [],
        localSessions: [],
        pendingDeletes: [],
        plan: [],
        timer: null,
        pendingSummary: null,
        localScope: '',
      });
    },
    appSnapshot() {
      const current = snapshot();
      return {
        sportSessions: cleanArray(current.sessions),
        sportSessionItems: cleanArray(current.items),
        sportSets: cleanArray(current.sets),
      };
    },
  };
}
