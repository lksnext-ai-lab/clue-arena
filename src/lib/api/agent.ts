/**
 * Agent facade — selects backend (local Genkit or MattinAI) based on AGENT_BACKEND env var.
 *
 * AGENT_BACKEND=local  → Genkit backend (development / CI / staging)
 * AGENT_BACKEND=mattin → MattinAI backend (default, production)
 *
 * All server-side callers must import invokeAgent from here, never directly
 * from mattin.ts or local-agent.ts.
 */
import type { AgentRequest, AgentResponse } from '@/types/api';

export type { AgentRequest, AgentResponse };

export async function invokeAgent(request: AgentRequest): Promise<AgentResponse> {
  if (process.env.AGENT_BACKEND === 'local') {
    const { invokeAgent: invokeLocal } = await import('./local-agent');
    return invokeLocal(request);
  }
  const { invokeAgent: invokeMattin } = await import('./mattin');
  return invokeMattin(request);
}
