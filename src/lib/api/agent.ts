/**
 * Agent facade — selects backend based on AGENT_BACKEND env var.
 *
 * AGENT_BACKEND=local      → Genkit backend (development / CI / staging)
 * AGENT_BACKEND=mattin     → MattinAI backend (default, production)
 *
 * All server-side callers must import invokeAgent from here, never directly
 * from mattin.ts or local-agent.ts.
 *
 * F012: invokeAgent now accepts an AgentInvocationContext for structured logging,
 * emits agent_invocation_start / agent_invocation_complete log entries, and
 * returns { response, invocacionId } so callers can log validation results.
 */
import type { AgentRequest, AgentResponse, AgentInvocationContext } from '@/types/api';
import { agentLog } from '@/lib/utils/logger';

export type { AgentRequest, AgentResponse };

function resolveBackendName(): 'mattin' | 'local' {
  if (process.env.AGENT_BACKEND === 'local') return 'local';
  return 'mattin';
}

export async function invokeAgent(
  request: AgentRequest,
  context: AgentInvocationContext,
): Promise<{ response: AgentResponse; invocacionId: string }> {
  const invocacionId = crypto.randomUUID();
  const tsStart = Date.now();
  const backendName = resolveBackendName();

  // ── Emit invocation start ─────────────────────────────────────────────────
  agentLog.info({
    event: 'agent_invocation_start',
    invocacionId,
    gameId: request.gameId,
    teamId: request.teamId,
    turnoId: context.turnoId,
    tipo: request.type,
    agentBackend: backendName,
    gameStateViewHash: context.gameStateViewHash ?? null,
  });

  let response: AgentResponse | null = null;
  let estado: 'completada' | 'timeout' | 'error' = 'error';
  let errorMessage: string | null = null;

  try {
    if (backendName === 'local') {
      const { invokeAgent: invokeLocal } = await import('./local-agent');
      response = await invokeLocal(request, { invocacionId, turnoId: context.turnoId });
    } else {
      const { invokeAgent: invokeMattin } = await import('./mattin');
      response = await invokeMattin(request, { invocacionId, turnoId: context.turnoId });
    }
    estado = 'completada';
    return { response, invocacionId };
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    estado = 'error';
    throw err;
  } finally {
    // ── Emit invocation complete (always, even on error) ──────────────────
    agentLog.info({
      event: 'agent_invocation_complete',
      invocacionId,
      gameId: request.gameId,
      teamId: request.teamId,
      turnoId: context.turnoId,
      estado,
      durationMs: Date.now() - tsStart,
      responseValid: null,   // validation result emitted separately in coordinator
      validationError: null,
      errorMessage,
      actionType: response?.action?.type ?? null,
    });
  }
}
