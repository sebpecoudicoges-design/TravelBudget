export function createInitialTripState() {
  return {
    trips: [],
    globalNetRows: [],
    activeTripId: null,
    budgetLinks: [],
    budgetTxById: new Map(),
    linkIssues: [],
    members: [],
    expenses: [],
    shares: [],
    settlementEvents: [],
    myRole: null,
    pendingInvites: [],
    lastInviteUrl: null,
    editingExpenseId: null,
    editingExpenseDraft: null,
    historyFilters: {},
    addExpenseOpen: false,
    _expenseSaving: false,
    _offlineReplaySaving: false,
    _tripsLoaded: false,
  };
}

export const TRIP_ACTIVE_STORAGE_KEY = 'travelbudget_trip_active_id_v1';
export const TRIP_TAB_STORAGE_KEY = 'travelbudget_trip_tab_v1';

function safeStorageGet(storage, key) {
  try {
    return storage?.getItem ? storage.getItem(key) : null;
  } catch (_) {
    return null;
  }
}

function safeStorageSet(storage, key, value) {
  try {
    if (storage?.setItem) storage.setItem(key, value);
  } catch (_) {}
}

function safeStorageRemove(storage, key) {
  try {
    if (storage?.removeItem) storage.removeItem(key);
  } catch (_) {}
}

function normalizeTripTab(tab) {
  return tab === 'history' ? 'history' : 'recap';
}

function replaceState(target, next) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, next);
  return target;
}

function normalizeRemoteAggregate(raw, identity = {}) {
  const members = Array.isArray(raw?.members) ? raw.members : [];
  const userId = String(identity.userId || '');
  const userEmail = String(identity.email || '').trim().toLowerCase();
  const meRow = members.find((row) => row.auth_user_id && String(row.auth_user_id) === userId)
    || (userEmail ? members.find((row) => String(row.email || '').trim().toLowerCase() === userEmail) : null)
    || members.find((row) => row.user_id && String(row.user_id) === userId)
    || members.find((row) => row.is_me === true && row.user_id && String(row.user_id) === userId)
    || null;
  const meId = meRow?.id ? String(meRow.id) : null;

  return {
    members: members.map((row) => {
      const isMe = !!meId && String(row.id) === meId;
      return {
        id: row.id,
        name: row.name,
        email: row.email || (isMe ? identity.email || null : null),
        authUserId: row.auth_user_id || null,
        userId: row.user_id || null,
        isMe,
      };
    }),
    expenses: (raw?.expenses || []).map((row) => ({
      id: row.id,
      date: row.date,
      label: row.label,
      amount: Number(row.amount),
      currency: row.currency,
      paidByMemberId: row.paid_by_member_id,
      category: row.category || null,
      subcategory: row.subcategory || null,
      budgetDateStart: row.budget_date_start || row.date || null,
      budgetDateEnd: row.budget_date_end || row.budget_date_start || row.date || null,
      transactionId: row.transaction_id || null,
      createdAt: row.created_at,
    })),
    shares: (raw?.shares || []).map((row) => ({
      id: row.id,
      expenseId: row.expense_id,
      memberId: row.member_id,
      shareAmount: Number(row.share_amount),
    })),
    settlementEvents: (raw?.settlementEvents || []).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      currency: row.currency,
      amount: Number(row.amount),
      fromMemberId: row.from_member_id,
      toMemberId: row.to_member_id,
      transactionId: row.transaction_id || null,
      createdBy: row.created_by || null,
      createdAt: row.created_at,
      cancelledAt: row.cancelled_at || null,
    })),
    budgetLinks: (raw?.budgetLinks || []).map((row) => ({
      expenseId: row.expense_id,
      transactionId: row.transaction_id,
      memberId: row.member_id || null,
    })),
    budgetTxById: new Map((raw?.budgetTransactions || []).map((row) => [String(row.id), row])),
  };
}

export function createTripStore(initialState = {}) {
  const state = Object.assign(createInitialTripState(), initialState);
  return {
    state,
    reset() {
      return replaceState(state, createInitialTripState());
    },
    clearActive() {
      Object.assign(state, {
        members: [], expenses: [], shares: [], settlementEvents: [],
        budgetLinks: [], budgetTxById: new Map(), linkIssues: [],
      });
      return state;
    },
    readActiveTripId(storage) {
      return safeStorageGet(storage, TRIP_ACTIVE_STORAGE_KEY);
    },
    setActiveTripId(tripId, storage) {
      state.activeTripId = tripId ? String(tripId) : null;
      if (state.activeTripId) safeStorageSet(storage, TRIP_ACTIVE_STORAGE_KEY, state.activeTripId);
      else safeStorageSet(storage, TRIP_ACTIVE_STORAGE_KEY, '');
      return state.activeTripId;
    },
    clearActiveTripId(storage) {
      state.activeTripId = null;
      safeStorageRemove(storage, TRIP_ACTIVE_STORAGE_KEY);
    },
    resolveActiveTripId(storage) {
      const trips = Array.isArray(state.trips) ? state.trips : [];
      const stored = safeStorageGet(storage, TRIP_ACTIVE_STORAGE_KEY);
      const active = stored && trips.some((trip) => String(trip?.id || '') === String(stored))
        ? stored
        : trips[0]?.id || null;
      state.activeTripId = active;
      return active;
    },
    readTab(storage) {
      return normalizeTripTab(safeStorageGet(storage, TRIP_TAB_STORAGE_KEY));
    },
    setTab(tab, storage) {
      const normalized = normalizeTripTab(tab);
      safeStorageSet(storage, TRIP_TAB_STORAGE_KEY, normalized);
      return normalized;
    },
    hydrateOffline(snapshot = {}) {
      Object.assign(state, {
        members: Array.isArray(snapshot.tripMembers) ? snapshot.tripMembers : (Array.isArray(snapshot.tripParticipants) ? snapshot.tripParticipants : []),
        expenses: Array.isArray(snapshot.tripExpenses) ? snapshot.tripExpenses : [],
        shares: Array.isArray(snapshot.tripExpenseShares) ? snapshot.tripExpenseShares : [],
        settlementEvents: Array.isArray(snapshot.tripSettlementEvents) ? snapshot.tripSettlementEvents : [],
        budgetLinks: Array.isArray(snapshot.tripBudgetLinks) ? snapshot.tripBudgetLinks : [],
        budgetTxById: new Map(),
        linkIssues: [],
      });
      return state;
    },
    hydrateRemote(raw, identity) {
      Object.assign(state, normalizeRemoteAggregate(raw, identity));
      return state;
    },
    appSnapshot() {
      return {
        tripGroups: Array.isArray(state.trips) ? state.trips : [],
        tripNetBalances: Array.isArray(state.globalNetRows) ? state.globalNetRows : [],
        tripMembers: Array.isArray(state.members) ? state.members : [],
        tripParticipants: Array.isArray(state.members) ? state.members : [],
        tripExpenses: Array.isArray(state.expenses) ? state.expenses : [],
        tripExpenseShares: Array.isArray(state.shares) ? state.shares : [],
        tripSettlementEvents: Array.isArray(state.settlementEvents) ? state.settlementEvents : [],
        tripBudgetLinks: Array.isArray(state.budgetLinks) ? state.budgetLinks : [],
      };
    },
  };
}
