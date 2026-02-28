/**
 * F012 — Logging helpers for the coordinator → Route Handler → validator chain.
 *
 * These helpers are called from Route Handlers after invokeAgent returns and
 * the AgentResponse has been validated, so they can emit the validation result
 * tied to the correct invocacionId.
 */
import { agentLog } from './logger';

/**
 * Emit an `agent_response_validation` log entry.
 *
 * @param invocacionId  UUID returned by invokeAgent
 * @param gameId        Partida identifier
 * @param teamId        Team identifier
 * @param turnoId       Turn record identifier
 * @param valid         Whether the response passed validation
 * @param validationError  Error description (undefined / null when valid)
 */
export function logInvocacionValidity(
  invocacionId: string,
  gameId: string,
  teamId: string,
  turnoId: string,
  valid: boolean,
  validationError?: string | null,
): void {
  agentLog.info({
    event: 'agent_response_validation',
    invocacionId,
    gameId,
    teamId,
    turnoId,
    responseValid: valid,
    validationError: validationError ?? null,
  });
}
