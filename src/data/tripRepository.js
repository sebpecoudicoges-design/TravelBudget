function requireClient(getClient) {
  const client = typeof getClient === 'function' ? getClient() : getClient;
  if (!client || typeof client.from !== 'function') throw new Error('Supabase indisponible');
  return client;
}

function unwrap(result) {
  if (result?.error) throw result.error;
  return result?.data || [];
}

function isMissingBudgetLinksError(error) {
  if (String(error?.code || '') === 'PGRST116') return true;
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('trip_expense_budget_links') || message.includes('relation') || message.includes('does not exist');
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

    async createSettlementEvent({ table, event }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table).insert([event]));
    },

    async cancelSettlementEvent({ table, eventId, cancelledAt }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table).update({ cancelled_at: cancelledAt }).eq('id', eventId));
    },

    async findLatestTransaction({ table, match }) {
      const client = requireClient(getClient);
      let query = client.from(table).select('id');
      for (const [column, value] of Object.entries(match || {})) query = query.eq(column, value);
      return unwrap(await query.order('created_at', { ascending: false }).limit(1).maybeSingle());
    },

    async linkSettlementTransaction({ table, eventId, transactionId }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table).update({ transaction_id: transactionId }).eq('id', eventId));
    },

    async recordSettlementLog({ table, row }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table).insert(row));
    },

    async deleteExpenseFallback({ tables, deleteTransactionRpc, expenseId, transactionId }) {
      const client = requireClient(getClient);
      const deletedTransactionIds = new Set();
      const deleteTransaction = async (id) => {
        const key = String(id || '');
        if (!key || deletedTransactionIds.has(key)) return;
        if (typeof client.rpc !== 'function') throw new Error('Supabase RPC indisponible');
        unwrap(await client.rpc(deleteTransactionRpc, { p_tx_id: key }));
        deletedTransactionIds.add(key);
      };

      try {
        const links = unwrap(await client.from(tables.budgetLinks).select('transaction_id').eq('expense_id', expenseId));
        if (links.length) {
          unwrap(await client.from(tables.budgetLinks).delete().eq('expense_id', expenseId));
          for (const row of links) await deleteTransaction(row.transaction_id);
        }
      } catch (error) {
        if (!isMissingBudgetLinksError(error)) throw error;
      }

      if (transactionId) {
        unwrap(await client.from(tables.expenses).update({ transaction_id: null }).eq('id', expenseId));
        unwrap(await client.from(tables.transactions).update({ trip_expense_id: null }).eq('id', transactionId));
        await deleteTransaction(transactionId);
      }

      try {
        const references = unwrap(await client.from(tables.transactions).select('id').eq('trip_expense_id', expenseId));
        for (const row of references) await deleteTransaction(row.id);
      } catch (_) {}

      unwrap(await client.from(tables.shares).delete().eq('expense_id', expenseId));
      unwrap(await client.from(tables.expenses).delete().eq('id', expenseId));
    },

    async moveExpense({ tables, expenseId, tripId }) {
      const client = requireClient(getClient);
      unwrap(await client.from(tables.expenses).update({ trip_id: tripId }).eq('id', expenseId));
      unwrap(await client.from(tables.shares).update({ trip_id: tripId }).eq('expense_id', expenseId));
      try {
        unwrap(await client.from(tables.budgetLinks).update({ trip_id: tripId }).eq('expense_id', expenseId));
        return { budgetLinkError: null };
      } catch (budgetLinkError) {
        return { budgetLinkError };
      }
    },

    async applyExpense({ rpcName, tripId, payload }) {
      const client = requireClient(getClient);
      if (typeof client.rpc !== 'function') throw new Error('Supabase RPC indisponible');
      const rows = unwrap(await client.rpc(rpcName, { p_trip_id: tripId, p_payload: payload }));
      const expenseId = (Array.isArray(rows) ? rows[0]?.expense_id : rows?.expense_id) || null;
      if (!expenseId) throw new Error(`${rpcName} n'a pas renvoye expense_id.`);
      return expenseId;
    },

    async getExpenseById({ table, expenseId }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table).select('*').eq('id', expenseId).single());
    },

    async findExpenseByFingerprint({ table, tripId, date, label, amount, currency, paidByMemberId }) {
      const client = requireClient(getClient);
      const rows = unwrap(await client.from(table)
        .select('id,created_at')
        .eq('trip_id', tripId)
        .eq('date', date)
        .eq('label', label)
        .eq('amount', amount)
        .eq('currency', currency)
        .eq('paid_by_member_id', paidByMemberId)
        .order('created_at', { ascending: true })
        .limit(1));
      return rows?.[0]?.id || null;
    },

    async linkExpenseTransaction({ tables, expenseId, transactionId }) {
      const client = requireClient(getClient);
      const expense = unwrap(await client.from(tables.expenses)
        .select('id,transaction_id').eq('id', expenseId).maybeSingle());
      if (expense?.transaction_id && expense.transaction_id !== transactionId) {
        throw new Error('Cette depense Trip est deja liee a une transaction.');
      }
      const transaction = unwrap(await client.from(tables.transactions)
        .select('id,trip_expense_id').eq('id', transactionId).maybeSingle());
      if (transaction?.trip_expense_id && transaction.trip_expense_id !== expenseId) {
        throw new Error('Cette transaction Budget est deja liee a une autre depense Trip.');
      }

      unwrap(await client.from(tables.expenses).update({ transaction_id: transactionId }).eq('id', expenseId));
      try {
        unwrap(await client.from(tables.transactions).update({ trip_expense_id: expenseId }).eq('id', transactionId));
      } catch (error) {
        unwrap(await client.from(tables.expenses).update({ transaction_id: null }).eq('id', expenseId));
        throw error;
      }

      const [expenseAfter, transactionAfter] = await Promise.all([
        client.from(tables.expenses).select('id,transaction_id').eq('id', expenseId).maybeSingle(),
        client.from(tables.transactions).select('id,trip_expense_id').eq('id', transactionId).maybeSingle(),
      ]);
      const confirmedExpense = unwrap(expenseAfter);
      const confirmedTransaction = unwrap(transactionAfter);
      if (confirmedExpense?.transaction_id !== transactionId || confirmedTransaction?.trip_expense_id !== expenseId) {
        await Promise.all([
          client.from(tables.expenses).update({ transaction_id: null }).eq('id', expenseId),
          client.from(tables.transactions).update({ trip_expense_id: null }).eq('id', transactionId),
        ]);
        throw new Error("Le lien avec la transaction selectionnee n'a pas pu etre confirme.");
      }
    },

    async unlinkExpenseTransaction({ tables, expenseId, transactionId }) {
      const client = requireClient(getClient);
      unwrap(await client.from(tables.transactions).update({ trip_expense_id: null }).eq('id', transactionId));
      unwrap(await client.from(tables.expenses).update({ transaction_id: null }).eq('id', expenseId));
    },
  };
}
