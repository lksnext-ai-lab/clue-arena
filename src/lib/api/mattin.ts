/**
 * MattinAI client backend — server-side only.
 * Implements the AgentRequest/AgentResponse contract.
 *
 * In production, set AGENT_BACKEND=mattin (or leave unset).
 * All callers should import invokeAgent from @/lib/api/agent, not from here directly.
 */
import type { AgentRequest, AgentResponse } from '@/types/api';

export async function invokeAgent(request: AgentRequest): Promise<AgentResponse> {
  const response = await fetch(
    `${process.env.MATTIN_API_URL}/public/v1/agent/invoke`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.MATTIN_API_KEY!,
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

