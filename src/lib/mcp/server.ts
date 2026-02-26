import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGameStateTool } from './tools/get-game-state';
import { makeSuggestionTool } from './tools/make-suggestion';
import { showCardTool } from './tools/show-card';
import { makeAccusationTool } from './tools/make-accusation';

// Singleton MCP Server instance
let mcpServerInstance: McpServer | null = null;

export function getMcpServer(): McpServer {
  if (mcpServerInstance) return mcpServerInstance;

  const server = new McpServer({
    name: 'clue-arena-cluedo',
    version: '1.0.0',
  });

  server.tool('get_game_state', getGameStateTool.schema, getGameStateTool.handler);
  server.tool('make_suggestion', makeSuggestionTool.schema, makeSuggestionTool.handler);
  server.tool('show_card', showCardTool.schema, showCardTool.handler);
  server.tool('make_accusation', makeAccusationTool.schema, makeAccusationTool.handler);

  mcpServerInstance = server;
  return server;
}
