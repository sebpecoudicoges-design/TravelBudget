// A deliberately small query port, backed by the restricted SQL reader role.
// The service client is never returned or passed into the finance repository.
export function createMcpScopedReadClient(serverClient, { userId, tokenHash, resource }) {
  return { from(table) {
    const filters = {};
    let ownerChecked = false;
    return {
      select() { return this; },
      eq(key, value) {
        if (key === 'user_id') { if (value !== userId) throw new Error('Owner mismatch'); ownerChecked = true; }
        else if (['id','period_id','wallet_id'].includes(key)) filters[key] = value;
        else throw new Error('Unsupported read filter');
        return this;
      },
      gte(key, value) { if (key !== 'date_start') throw new Error('Unsupported read filter'); filters.date_from = value; return this; },
      lte(key, value) { if (key !== 'date_start') throw new Error('Unsupported read filter'); filters.date_to = value; return this; },
      order(key, options) { if (key !== 'id' || options?.ascending !== true) throw new Error('Unsupported read order'); return this; },
      async range(start, end) {
        if (!ownerChecked) throw new Error('Owner filter required');
        return serverClient.rpc('mcp_read_finance_v1', { p_hash: tokenHash, p_resource: resource,
          p_table: table, p_filters: filters, p_offset: start, p_limit: end-start+1 });
      },
    };
  } };
}
