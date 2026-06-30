function requireClient(getClient) {
  const client = typeof getClient === 'function' ? getClient() : getClient;
  if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') {
    throw new Error('Supabase indisponible');
  }
  return client;
}

function unwrap(result) {
  if (result?.error) throw result.error;
  return result?.data ?? null;
}

export function createSupabaseRepository(getClient) {
  return {
    async rpc(name, args = {}) {
      const client = requireClient(getClient);
      return unwrap(await client.rpc(name, args));
    },

    async select(table, options = {}) {
      const client = requireClient(getClient);
      let query = client.from(table).select(options.columns || '*');
      for (const [column, value] of Object.entries(options.equals || {})) query = query.eq(column, value);
      if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending !== false });
      if (Number.isFinite(options.limit)) query = query.limit(options.limit);
      if (options.maybeSingle) query = query.maybeSingle();
      else if (options.single) query = query.single();
      return unwrap(await query);
    },

    async insert(table, values, options = {}) {
      const client = requireClient(getClient);
      let query = client.from(table).insert(values);
      if (options.select) query = query.select(options.select === true ? '*' : options.select);
      return unwrap(await query);
    },

    async upsert(table, values, options = {}) {
      const client = requireClient(getClient);
      let query = client.from(table).upsert(values, {
        onConflict: options.onConflict,
        ignoreDuplicates: !!options.ignoreDuplicates,
      });
      if (options.select) query = query.select(options.select === true ? '*' : options.select);
      return unwrap(await query);
    },

    async update(table, values, equals = {}, options = {}) {
      const client = requireClient(getClient);
      let query = client.from(table).update(values);
      for (const [column, value] of Object.entries(equals)) query = query.eq(column, value);
      if (options.select) query = query.select(options.select === true ? '*' : options.select);
      return unwrap(await query);
    },

    async remove(table, equals = {}) {
      const client = requireClient(getClient);
      let query = client.from(table).delete();
      for (const [column, value] of Object.entries(equals)) query = query.eq(column, value);
      return unwrap(await query);
    },
  };
}

