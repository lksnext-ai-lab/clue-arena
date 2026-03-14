import { NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer, MCP_SERVER_INFO, MCP_TOOL_NAMES } from '@/lib/mcp/server';
import { createMcpCallContext, mcpContextStorage } from '@/lib/mcp/tools/context';
import { mcpLog } from '@/lib/utils/logger';

/**
 * MCP Server endpoint — HTTP Streamable transport (stateless).
 * Accessible by MattinAI via Bearer token (Authorization header) or API key
 * (X-API-Key header). When X-API-Key is present it takes priority and the
 * Authorization header is ignored (ADR-0008).
 * Excluded from Next.js session middleware.
 *
 * F012: Extracts X-Clue-Invocation-Id and X-Clue-Turno-Id headers to build
 * a McpCallContext that is propagated to tool handlers via AsyncLocalStorage.
 */
export async function POST(request: Request) {
  const tsStart = Date.now();

  // Verify MCP token (ADR-0008)
  // API Key via X-API-Key header takes priority; Authorization header is ignored when present.
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey !== null) {
    if (apiKey !== process.env.MCP_AUTH_TOKEN) {
      mcpLog.warn({ event: 'mcp_request_unauthorized', reason: 'invalid_x_api_key' });
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.MCP_AUTH_TOKEN}`) {
      mcpLog.warn({ event: 'mcp_request_unauthorized', reason: 'invalid_bearer_token' });
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // F012: build call context from request headers
  const invocacionId = request.headers.get('x-clue-invocation-id') ?? 'unknown';
  const turnoId = request.headers.get('x-clue-turno-id') ?? 'unknown';
  // gameId/teamId will be 'unknown' at this level; per-call values come from tool params
  const mcpCtx = createMcpCallContext(invocacionId, 'unknown', 'unknown', turnoId);

  const isDebug = process.env.LOG_LEVEL === 'debug';

  mcpLog.info({
    event: 'mcp_request_received',
    invocacionId,
    turnoId,
    contentType: request.headers.get('content-type') ?? 'unknown',
    contentLength: request.headers.get('content-length') ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    ...(isDebug && {
      allHeaders: Object.fromEntries(
        [...(request.headers as unknown as Iterable<[string, string]>)].filter(
          ([k]) => !['authorization', 'x-api-key'].includes(k.toLowerCase()),
        ),
      ),
    }),
  });

  let responseStatus = 200;

  try {
    // All tool handlers run within the McpCallContext so withMcpLog can correlate entries
    const result = await mcpContextStorage.run(mcpCtx, async () => {
      const server = createMcpServer();

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      await server.connect(transport);
      return transport.handleRequest(request);
    });

    responseStatus = result.status ?? 200;

    mcpLog.info({
      event: 'mcp_request_complete',
      invocacionId,
      turnoId,
      status: responseStatus,
      durationMs: Date.now() - tsStart,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    responseStatus = 500;

    mcpLog.error({
      event: 'mcp_request_error',
      invocacionId,
      turnoId,
      status: responseStatus,
      durationMs: Date.now() - tsStart,
      errorMessage,
    });

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
