import { NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { makeSuggestionTool } from '@/lib/mcp/tools/make-suggestion';
import { showCardTool } from '@/lib/mcp/tools/show-card';
import { makeAccusationTool } from '@/lib/mcp/tools/make-accusation';
import { withMcpLog } from '@/lib/mcp/tools/_log-wrapper';
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
      const server = new McpServer({
        name: 'clue-arena-cluedo',
        version: '1.0.0',
      });

      server.tool('get_game_state', getGameStateTool.schema, withMcpLog('get_game_state', getGameStateTool.handler));
      server.tool('make_suggestion', makeSuggestionTool.schema, withMcpLog('make_suggestion', makeSuggestionTool.handler));
      server.tool('show_card', showCardTool.schema, withMcpLog('show_card', showCardTool.handler));
      server.tool('make_accusation', makeAccusationTool.schema, withMcpLog('make_accusation', makeAccusationTool.handler));

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
    name: 'clue-arena-cluedo',
    version: '1.0.0',
    tools: ['get_game_state', 'make_suggestion', 'show_card', 'make_accusation'],
  });
}
