/**
 * MCP Server factory.
 *
 * `createMcpServer()` builds a fresh McpServer with all tools registered.
 * A new instance should be created per-request when using the stateless
 * WebStandardStreamableHTTPServerTransport (see src/app/api/mcp/route.ts).
 *
 * This is the single source of truth for tool registration — the route
 * handler and tests both call this function so they can never drift apart.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGameStateTool } from './tools/get-game-state';
import { makeSuggestionTool } from './tools/make-suggestion';
import { showCardTool } from './tools/show-card';
import { makeAccusationTool } from './tools/make-accusation';
import { saveAgentMemoryTool } from './tools/save-agent-memory';
import { getAgentMemoryTool } from './tools/get-agent-memory';
import { withMcpLog } from './tools/_log-wrapper';

export const MCP_SERVER_INFO = { name: 'clue-arena-cluedo', version: '1.0.0' } as const;

export const MCP_TOOL_NAMES = [
  'get_game_state',
  'make_suggestion',
  'show_card',
  'make_accusation',
  'save_agent_memory',
  'get_agent_memory',
] as const;

/**
 * Create a fresh McpServer with all six tools registered.
 * Call once per HTTP request (stateless transport) or once per test suite.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(MCP_SERVER_INFO);

  server.registerTool('get_game_state',     { inputSchema: getGameStateTool.schema },     withMcpLog('get_game_state',     getGameStateTool.handler));
  server.registerTool('make_suggestion',    { inputSchema: makeSuggestionTool.schema },    withMcpLog('make_suggestion',    makeSuggestionTool.handler));
  server.registerTool('show_card',          { inputSchema: showCardTool.schema },          withMcpLog('show_card',          showCardTool.handler));
  server.registerTool('make_accusation',    { inputSchema: makeAccusationTool.schema },    withMcpLog('make_accusation',    makeAccusationTool.handler));
  server.registerTool('save_agent_memory',  { inputSchema: saveAgentMemoryTool.schema },  withMcpLog('save_agent_memory',  saveAgentMemoryTool.handler));
  server.registerTool('get_agent_memory',   { inputSchema: getAgentMemoryTool.schema },   withMcpLog('get_agent_memory',   getAgentMemoryTool.handler));

  return server;
}
