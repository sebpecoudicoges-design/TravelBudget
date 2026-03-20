/* =========================
   Travel Context
   ========================= */

function getActiveTravel() {
  if (!state.travels) return null;
  return state.travels.find(t => t.id === state.activeTravelId) || null;
}

function isActiveTravel(obj) {
  return obj && obj.travel_id === state.activeTravelId;
}

function filterByActiveTravel(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isActiveTravel);
}

async function loadTravelContext() {

  const travelId = state.activeTravelId;

  if (!travelId) {
    console.warn("[TravelContext] no active travel");
    return;
  }

  try {

    const [periods, wallets, transactions, recurringRules] =
      await Promise.all([
        loadPeriods(travelId),
        loadWallets(travelId),
        loadTransactions(travelId),
        loadRecurringRules(travelId)
      ]);

    state.periods = periods || [];
    state.wallets = wallets || [];
    state.transactions = transactions || [];
    state.recurringRules = recurringRules || [];

  } catch (e) {

    console.error("[TravelContext] load failed", e);

  }

}