import { NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer, MCP_SERVER_INFO, MCP_TOOL_NAMES } from '@/lib/mcp/server';
import { createMcpCallContext, mcpContextStorage } from '@/lib/mcp/tools/context';

/**
 * MCP Server endpoint — HTTP Streamable transport (stateless).
 * Accessible by MattinAI via Bearer token authentication (ADR-0008).
 * Excluded from Next.js session middleware.
 *
 * F012: Extracts X-Clue-Invocation-Id and X-Clue-Turno-Id headers to build
 * a McpCallContext that is propagated to tool handlers via AsyncLocalStorage.
 */
export async function POST(request: Request) {
  // Verify MCP token (ADR-0008)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.MCP_AUTH_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // F012: build call context from request headers
  const invocacionId = request.headers.get('x-clue-invocation-id') ?? 'unknown';
  const turnoId = request.headers.get('x-clue-turno-id') ?? 'unknown';
  // gameId/teamId will be 'unknown' at this level; per-call values come from tool params
  const mcpCtx = createMcpCallContext(invocacionId, 'unknown', 'unknown', turnoId);

  try {
    // All tool handlers run within the McpCallContext so withMcpLog can correlate entries
    return await mcpContextStorage.run(mcpCtx, async () => {
      const server = createMcpServer();

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      await server.connect(transport);
      return transport.handleRequest(request);
    });
  } catch (error) {
    console.error('MCP Server error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Support GET for MCP discovery / health
export async function GET() {
  return NextResponse.json({
    ...MCP_SERVER_INFO,
    tools: MCP_TOOL_NAMES,
  });
}
