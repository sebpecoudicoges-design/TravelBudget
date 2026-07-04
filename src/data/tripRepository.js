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
      if (!tripId) return { members: [], expenses: [], shares: [], settlementEvents: [], budgetLinks: [], budgetTransactions: [] };
      const client = requireClient(getClient);
      const [members, expenses, shares, settlementEvents] = await Promise.all([
        client.from(tables.members).select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
        client.from(tables.expenses).select('*').eq('trip_id', tripId).order('date', { ascending: false }),
        client.from(tables.shares).select('*').eq('trip_id', tripId),
        client.from(tables.settlementEvents).select('*').eq('trip_id', tripId).is('cancelled_at', null),
      ]);
      const aggregate = {
        members: unwrap(members),
        expenses: unwrap(expenses),
        shares: unwrap(shares),
        settlementEvents: unwrap(settlementEvents),
        budgetLinks: [],
        budgetTransactions: [],
      };
      const expenseIds = aggregate.expenses.map((row) => row.id).filter(Boolean);
      if (!expenseIds.length || !tables.budgetLinks || !tables.transactions) return aggregate;

      try {
        aggregate.budgetLinks = unwrap(await client.from(tables.budgetLinks)
          .select('expense_id,transaction_id,member_id')
          .eq('trip_id', tripId)
          .in('expense_id', expenseIds));
        const transactionIds = [...new Set(aggregate.budgetLinks.map((row) => row.transaction_id).filter(Boolean))];
        if (transactionIds.length) {
          aggregate.budgetTransactions = unwrap(await client.from(tables.transactions)
            .select('id,category,is_internal,trip_expense_id,trip_share_link_id,pay_now,affects_budget,out_of_budget')
            .in('id', transactionIds));
        }
      } catch (error) {
        aggregate.budgetLinks = [];
        aggregate.budgetTransactions = [];
        aggregate.budgetLoadError = error;
      }
      return aggregate;
    },
  };
}
