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

function getErrorCause(err: unknown): { message?: string; code?: string } | null {
  if (
    typeof err !== 'object' ||
    err === null ||
    !('cause' in err) ||
    typeof (err as { cause?: unknown }).cause !== 'object' ||
    (err as { cause?: unknown }).cause === null
  ) {
    return null;
  }

  return (err as { cause: { message?: string; code?: string } }).cause;
}

function errorMessageIncludes(err: Error, pattern: RegExp): boolean {
  if (pattern.test(err.message)) return true;

  const cause = getErrorCause(err);
  if (cause?.message && pattern.test(cause.message)) return true;
  if (cause?.code && pattern.test(cause.code)) return true;

  return false;
}

function classifyInvocationStatus(err: unknown): 'timeout' | 'error' {
  if (
    err instanceof Error &&
    (
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      errorMessageIncludes(err, /timeout|timed out/i)
    )
  ) {
    return 'timeout';
  }

  return 'error';
}

function formatInvocationError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const cause = getErrorCause(err);
  const causeParts = [cause?.code, cause?.message].filter(Boolean);
  if (causeParts.length === 0) return err.message;

  return `${err.message} (${causeParts.join(': ')})`;
}

export async function invokeAgent(
  request: AgentRequest,
  context: AgentInvocationContext,
): Promise<{ response: AgentResponse; invocacionId: string }> {
  const invocacionId = crypto.randomUUID();
  const tsStart = Date.now();
  const backendName = context.agentBackend ?? resolveBackendName();

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
      response = await invokeMattin(request, {
        invocacionId,
        turnoId: context.turnoId,
        agentId: context.mattinAgentId,
        appId: context.mattinAppId,
        apiKey: context.mattinApiKey,
      });
    }
    estado = 'completada';
    return { response, invocacionId };
  } catch (err) {
    errorMessage = formatInvocationError(err);
    estado = classifyInvocationStatus(err);
    throw err;
  } finally {
    // ── Emit invocation complete (always, even on error) ──────────────────
    const logPayload = {
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
    };

    if (estado === 'completada') {
      agentLog.info(logPayload);
    } else if (estado === 'timeout') {
      agentLog.warn(logPayload);
    } else {
      agentLog.error(logPayload);
    }
  }
}
