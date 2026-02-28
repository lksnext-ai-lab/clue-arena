/**
 * MattinAI client backend — server-side only.
 * Implements the AgentRequest/AgentResponse contract.
 *
 * In production, set AGENT_BACKEND=mattin (or leave unset).
 * All callers should import invokeAgent from @/lib/api/agent, not from here directly.
 *
 * F012: Propagates invocacionId and turnoId as request headers so the MCP
 * endpoint can correlate tool calls back to the owning invocation cycle.
 */
import type { AgentRequest, AgentResponse } from '@/types/api';

export interface MattinInvokeOptions {
  invocacionId: string;
  turnoId: string;
}

export async function invokeAgent(
  request: AgentRequest,
  options: MattinInvokeOptions,
): Promise<AgentResponse> {
  const response = await fetch(
    `${process.env.MATTIN_API_URL}/public/v1/agent/invoke`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.MATTIN_API_KEY!,
        // F012: propagate correlation headers so MattinAI passes them to /api/mcp
        'X-Clue-Invocation-Id': options.invocacionId,
        'X-Clue-Turno-Id': options.turnoId,
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(`MattinAI API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AgentResponse;
  return data;
}
