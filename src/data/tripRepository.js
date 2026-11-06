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

// Stop only on an empty page. The server can cap responses below our requested limit.
async function allPages(makeQuery) {
  const rows = [];
  let cursor;
  for (;;) {
    let query = makeQuery().order('id', { ascending: true }).limit(500);
    if (cursor) query = query.gt('id', cursor);
    const { data: page, error } = await query;
    if (error) throw error;
    if (!Array.isArray(page)) throw new Error('Chargement Trip incomplet.');
    if (!page.length) return rows;
    const next = page[page.length - 1].id;
    if (!next || (cursor && next <= cursor)) throw new Error('Chargement Trip incomplet.');
    rows.push(...page);
    cursor = next;
  }
}

async function readByIds(client, table, columns, key, ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 64) {
    const batch = ids.slice(offset, offset + 64);
    const matches = await allPages(() => client.from(table).select(columns).in(key, batch));
    for (const row of matches) rows.push(row);
  }
  return rows;
}

export function createTripRepository(getClient) {
  return {
    async loadActiveTripData({ tripId, tables }) {
      if (!tripId) return { members: [], expenses: [], shares: [], settlementEvents: [], budgetLinks: [], budgetTransactions: [] };
      const client = requireClient(getClient);
      const read = (table, columns = '*') => client.from(table).select(columns).eq('trip_id', tripId);
      const [members, expenses, shares, settlementEvents, budgetLinks] = await Promise.all([
        allPages(() => read(tables.members)),
        allPages(() => read(tables.expenses)),
        allPages(() => read(tables.shares)),
        allPages(() => read(tables.settlementEvents).is('cancelled_at', null)),
        tables.budgetLinks && tables.transactions
          ? allPages(() => read(tables.budgetLinks, 'id,expense_id,transaction_id,member_id'))
          : [],
      ]);
      members.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      expenses.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const ids = [...new Set(budgetLinks.map(row => row.transaction_id).filter(Boolean))];
      const budgetTransactions = await readByIds(client, tables.transactions,
        'id,category,is_internal,trip_expense_id,trip_share_link_id,pay_now,affects_budget,out_of_budget', 'id', ids);
      return { members, expenses, shares, settlementEvents, budgetLinks, budgetTransactions };
    },

    async loadLinkAuditTransactions({ table, mainTxIds, expenseIds }) {
      const client = requireClient(getClient);
      const columns = 'id,trip_expense_id,label';
      return Promise.all([
        readByIds(client, table, columns, 'id', mainTxIds),
        readByIds(client, table, columns, 'trip_expense_id', expenseIds),
      ]);
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

    async deleteTrip({ tripId }) {
      const client = requireClient(getClient);
      const id = unwrap(await client.rpc('trip_delete_group_v1', { p_trip_id: tripId }));
      if (id !== tripId) throw new Error('Suppression du Trip non confirmée.');
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

    async applySettlement({ args }) {
      const client = requireClient(getClient);
      const id = unwrap(await client.rpc('trip_apply_settlement_v2', args));
      if (typeof id !== 'string' || !id) throw new Error('Règlement non confirmé par le serveur.');
      return id;
    },

    async cancelSettlement({ eventId }) {
      const client = requireClient(getClient);
      return unwrap(await client.rpc('trip_cancel_settlement_v1', { p_event_id: eventId }));
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

    async findExpenseByFingerprint({ table, tripId, date, label, amount, currency, paidByMemberId, kind }) {
      const client = requireClient(getClient);
      let query = client.from(table)
        .select('id,created_at')
        .eq('trip_id', tripId)
        .eq('date', date)
        .eq('label', label)
        .eq('amount', amount)
        .eq('currency', currency)
        .eq('paid_by_member_id', paidByMemberId);
      if (kind) query = query.eq('kind', kind === 'income' ? 'income' : 'expense');
      const rows = unwrap(await query
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
