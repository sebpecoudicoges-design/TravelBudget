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

    async createTrip({ tables, userId, name, baseCurrency, email }) {
      const client = requireClient(getClient);
      const trip = unwrap(await client.from(tables.groups)
        .insert([{ user_id: userId, name, base_currency: baseCurrency }])
        .select('*')
        .single());
      unwrap(await client.from(tables.participants).upsert([{
        trip_id: trip.id,
        auth_user_id: userId,
        role: 'owner',
      }], { onConflict: 'trip_id,auth_user_id' }));

      const member = { trip_id: trip.id, name: 'Moi', is_me: false, auth_user_id: userId, user_id: userId };
      if (email) member.email = email;
      let defaultMemberError = null;
      try {
        unwrap(await client.from(tables.members).insert([member]));
      } catch (error) {
        if (member.email && String(error?.message || '').toLowerCase().includes('email')) {
          const memberWithoutEmail = { ...member };
          delete memberWithoutEmail.email;
          try { unwrap(await client.from(tables.members).insert([memberWithoutEmail])); } catch (retryError) { defaultMemberError = retryError; }
        } else {
          defaultMemberError = error;
        }
      }
      return { trip, defaultMemberError };
    },

    async deleteTrip({ tables, tripId }) {
      const client = requireClient(getClient);
      let unlinkError = null;
      try {
        const expenses = unwrap(await client.from(tables.expenses)
          .select('id,transaction_id')
          .eq('trip_id', tripId));
        const transactionIds = expenses.map((row) => row.transaction_id).filter(Boolean);
        const expenseIds = expenses.map((row) => row.id).filter(Boolean);
        if (transactionIds.length) {
          unwrap(await client.from(tables.transactions).update({ trip_expense_id: null }).in('id', transactionIds));
        }
        if (expenseIds.length) {
          unwrap(await client.from(tables.expenses).update({ transaction_id: null }).in('id', expenseIds));
        }
      } catch (error) {
        unlinkError = error;
      }

      unwrap(await client.from(tables.shares).delete().eq('trip_id', tripId));
      unwrap(await client.from(tables.expenses).delete().eq('trip_id', tripId));
      unwrap(await client.from(tables.members).delete().eq('trip_id', tripId));
      unwrap(await client.from(tables.groups).delete().eq('id', tripId));
      return { unlinkError };
    },

    async addMember({ table, tripId, userId, name, email }) {
      const client = requireClient(getClient);
      const member = { trip_id: tripId, name, is_me: false, auth_user_id: null, user_id: userId };
      if (email) member.email = email;
      try {
        return unwrap(await client.from(table).insert([member]));
      } catch (error) {
        if (!member.email || !String(error?.message || '').toLowerCase().includes('email')) throw error;
        const memberWithoutEmail = { ...member };
        delete memberWithoutEmail.email;
        return unwrap(await client.from(table).insert([memberWithoutEmail]));
      }
    },

    async renameMember({ table, tripId, memberId, name }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table).update({ name }).eq('trip_id', tripId).eq('id', memberId));
    },

    async deleteMember({ table, tripId, memberId }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table).delete().eq('trip_id', tripId).eq('id', memberId));
    },
  };
}
