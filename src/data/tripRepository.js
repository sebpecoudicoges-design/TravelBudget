function requireClient(getClient) {
  const client = typeof getClient === 'function' ? getClient() : getClient;
  if (!client || typeof client.from !== 'function') throw new Error('Supabase indisponible');
  return client;
}

function unwrap(result) {
  if (result?.error) throw result.error;
  return result?.data || [];
}

export function createTripRepository(getClient) {
  return {
    async loadActiveTripData({ tripId, tables }) {
      if (!tripId) return { members: [], expenses: [], shares: [], settlementEvents: [] };
      const client = requireClient(getClient);
      const [members, expenses, shares, settlementEvents] = await Promise.all([
        client.from(tables.members).select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
        client.from(tables.expenses).select('*').eq('trip_id', tripId).order('date', { ascending: false }),
        client.from(tables.shares).select('*').eq('trip_id', tripId),
        client.from(tables.settlementEvents).select('*').eq('trip_id', tripId).is('cancelled_at', null),
      ]);
      return {
        members: unwrap(members),
        expenses: unwrap(expenses),
        shares: unwrap(shares),
        settlementEvents: unwrap(settlementEvents),
      };
    },
  };
}
