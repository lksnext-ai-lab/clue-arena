import { NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { getGameStateTool } from '@/lib/mcp/tools/get-game-state';
import { makeSuggestionTool } from '@/lib/mcp/tools/make-suggestion';
import { showCardTool } from '@/lib/mcp/tools/show-card';
import { makeAccusationTool } from '@/lib/mcp/tools/make-accusation';

/**
 * MCP Server endpoint — HTTP Streamable transport (stateless).
 * Accessible by MattinAI via Bearer token authentication (ADR-0008).
 * Excluded from Next.js session middleware.
 */
export async function POST(request: Request) {
  // Verify MCP token (ADR-0008)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.MCP_AUTH_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const server = new McpServer({
      name: 'clue-arena-cluedo',
      version: '1.0.0',
    });

    server.tool('get_game_state', getGameStateTool.schema, getGameStateTool.handler);
    server.tool('make_suggestion', makeSuggestionTool.schema, makeSuggestionTool.handler);
    server.tool('show_card', showCardTool.schema, showCardTool.handler);
    server.tool('make_accusation', makeAccusationTool.schema, makeAccusationTool.handler);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    await server.connect(transport);
    return transport.handleRequest(request);
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
