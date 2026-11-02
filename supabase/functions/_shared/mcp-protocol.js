// SDK injected for Node tests and Deno deployment; no hand-written JSON-RPC parser.
export function createMcpProtocol({ Server, createMcpHandler }, tools, makeDispatcher) {
  return async (request, identity, token) => {
    const dispatch = await makeDispatcher(identity, token);
    const handler = createMcpHandler(() => {
    const server = new Server({ name: 'TravelBudget', version: '1.2.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler('tools/list', async () => {
      // Catalog metadata only: never log tokens, arguments or personal results.
      console.info(JSON.stringify({event:'mcp_tools_list',version:'1.2.0',count:tools.length,names:tools.map(tool=>tool.name)}));
      return { tools };
    });
    server.setRequestHandler('tools/call', async ({ params }) => {
      try {
        const result = await dispatch(params.name, params.arguments || {});
        return { content: result.mcpContent || [{ type: 'text', text: JSON.stringify(result) }] };
      } catch {
        return { isError: true, content: [{ type: 'text', text: 'Lecture refusée ou incomplète. Aucun total partiel ne doit être interprété.' }] };
      }
    });
    return server;
    }, { legacy:'stateless', responseMode:'json', maxRequestBodySize:16384, maxSubscriptions:0, keepAliveMs:0 });
    try {
      const response = await handler.fetch(request);
      // Legacy SDK responses are finite SSE exchanges. Finish them before closing.
      return new Response(await response.arrayBuffer(), { status:response.status,headers:response.headers });
    } finally { await handler.close(); }
  };
}
