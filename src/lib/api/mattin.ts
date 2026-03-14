/**
 * MattinAI client backend — server-side only.
 * Implements the AgentRequest/AgentResponse contract.
 *
 * In production, set AGENT_BACKEND=mattin (or leave unset).
 * All callers should import invokeAgent from @/lib/api/agent, not from here directly.
 *
 * F012: Propagates invocacionId and turnoId as request headers so the MCP
 * endpoint can correlate tool calls back to the owning invocation cycle.
 *
 * Per-team credentials: agentId + appId + apiKey are required.
 * URL built as POST /public/v1/app/{appId}/chat/{agentId}/call per the spec.
 */
import type { AgentRequest, AgentResponse } from '@/types/api';

export interface MattinInvokeOptions {
  invocacionId: string;
  turnoId: string;
  /** Per-team agent ID — used as path param in the MattinAI chat endpoint */
  agentId?: string;
  /** Per-team app ID — used as path param in the MattinAI chat endpoint */
  appId?: string;
  /** Per-team API key — overrides MATTIN_API_KEY env var when set */
  apiKey?: string;
}

interface MattinChatResponse {
  response: string;
  conversation_id: string;
  usage: {
    agent_name: string;
    agent_type: string;
    files_processed: number;
    has_memory: boolean;
  };
}

/**
 * Per-turn hard timeout for MattinAI HTTP calls.
 * If the remote server accepts the connection but never responds, the fetch
 * throws a TimeoutError after this many milliseconds, which the coordinator
 * catch block converts into an EVT_TIMEOUT penalty pass.
 * Override with MATTIN_TURN_TIMEOUT_MS env var.
 */
const FETCH_TIMEOUT_MS = parseInt(process.env.MATTIN_TURN_TIMEOUT_MS ?? '90000', 10);

export async function invokeAgent(
  request: AgentRequest,
  options: MattinInvokeOptions,
): Promise<AgentResponse> {
  const apiKey = options.apiKey ?? process.env.MATTIN_API_KEY!;

  if (!options.agentId || !options.appId) {
    throw new Error('MattinAI: agentId and appId are required to invoke an agent');
  }
  const mattinUrl = `${process.env.MATTIN_API_URL}/public/v1/app/${encodeURIComponent(options.appId)}/chat/${encodeURIComponent(options.agentId)}/call`;

  // MattinAI /call endpoint expects multipart/form-data with a `message` field.
  // Do NOT set Content-Type manually — fetch sets it automatically with the correct boundary.
  const formData = new FormData();
  formData.append('message', JSON.stringify(request));

  const response = await fetch(mattinUrl, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      // F012: propagate correlation headers so MattinAI passes them to /api/mcp
      'X-Clue-Invocation-Id': options.invocacionId,
      'X-Clue-Turno-Id': options.turnoId,
    },
    body: formData,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status === 401) {
    throw new Error('MattinAI API error: 401 Unauthorized — invalid or missing API key');
  }
  if (response.status === 404) {
    throw new Error('MattinAI API error: 404 Not Found — agent not found or no access');
  }
  if (response.status === 500) {
    throw new Error('MattinAI API error: 500 Internal Server Error — agent execution failed');
  }
  if (!response.ok) {
    throw new Error(`MattinAI API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as MattinChatResponse;
  return JSON.parse(data.response) as AgentResponse;
}
