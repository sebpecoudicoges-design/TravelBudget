// Service-role client stays inside the trusted server. No raw credentials are stored.
export function createMcpOAuthStore(serverClient) {
  if (typeof serverClient?.rpc !== 'function') throw new Error('Server persistence client required');
  return {
    async run(operation, payload) {
      const { data, error } = await serverClient.rpc('mcp_oauth_state_v1', { p_operation: operation, p_input: payload });
      if (error) throw new Error('MCP authorization storage unavailable');
      return data;
    },
  };
}
