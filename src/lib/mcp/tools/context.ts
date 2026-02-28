/**
 * F012 — McpCallContext
 *
 * Context object propagated to every MCP tool handler so it can:
 *  1. Correlate log entries back to the parent agent invocation (invocacionId).
 *  2. Enforce the per-invocation call limit (MAX_TOOL_CALLS_PER_INVOCATION).
 *  3. Provide a monotonically increasing sequence number for ordering tool calls.
 *
 * AsyncLocalStorage exports allow transparent context propagation without
 * threading a context object through every call site:
 *  - `mcpContextStorage` is set by the coordinator (for local agent) or the
 *    MCP route handler (for MattinAI) before handlers are invoked.
 *
 * Node.js runtime only.
 */
import { AsyncLocalStorage } from 'async_hooks';
import { mcpLog } from '@/lib/utils/logger';

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of MCP tool calls allowed per agent invocation. */
export const MAX_TOOL_CALLS_PER_INVOCATION = 20;

// ── Error ────────────────────────────────────────────────────────────────────

export class McpToolLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpToolLimitExceededError';
  }
}

// ── AsyncLocalStorage ────────────────────────────────────────────────────────

/**
 * Singleton store for the current McpCallContext.
 * Set by the coordinator (local agent) or the MCP route handler (MattinAI)
 * via `mcpContextStorage.run(ctx, fn)` before any tool handler is called.
 */
export const mcpContextStorage = new AsyncLocalStorage<McpCallContext>();

// ── Context interface ────────────────────────────────────────────────────────

export interface McpCallContext {
  /** UUID v4 from the parent invokeAgent call */
  invocacionId: string;
  gameId: string;
  teamId: string;
  turnoId: string;
  /**
   * Returns the next 1-based sequence number for the current tool call.
   * Throws McpToolLimitExceededError (and emits a log entry) when the limit is
   * reached.
   */
  nextSequence(): number;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createMcpCallContext(
  invocacionId: string,
  gameId: string,
  teamId: string,
  turnoId: string,
): McpCallContext {
  let seq = 0;
  return {
    invocacionId,
    gameId,
    teamId,
    turnoId,
    nextSequence(): number {
      if (seq >= MAX_TOOL_CALLS_PER_INVOCATION) {
        const overSeq = seq + 1;
        mcpLog.warn({
          event: 'mcp_tool_limit_exceeded',
          invocacionId,
          gameId,
          teamId,
          turnoId,
          secuencia: overSeq,
        });
        throw new McpToolLimitExceededError(
          `Máximo de ${MAX_TOOL_CALLS_PER_INVOCATION} llamadas MCP por invocación superado`,
        );
      }
      return ++seq;
    },
  };
}
