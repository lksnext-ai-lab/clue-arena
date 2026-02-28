/**
 * F012 — MCP tool call logging wrapper
 *
 * Wraps any MCP tool handler to emit a structured `mcp_tool_call` log entry
 * on every invocation, including duration, error state, and output hash.
 *
 * Context propagation via AsyncLocalStorage:
 *  - When called from the local agent, `mcpContextStorage` is set by agent.ts.
 *  - When called via the MCP HTTP endpoint, `mcpContextStorage` is set by the
 *    `/api/mcp` route handler using the `X-Clue-Invocation-Id` header.
 *  - If no context is present (tests, direct calls), a fallback minimal logging
 *    is used without crashing.
 *
 * At LOG_LEVEL=debug the full input and output payloads are included; at the
 * default `info` level only the SHA-256 of the output is logged.
 */
import { mcpLog } from '@/lib/utils/logger';
import { hashSHA256 } from '@/lib/utils/crypto';
import { mcpContextStorage } from './context';

/**
 * Wrap a tool handler with per-call structured logging.
 * The McpCallContext (for correlation and sequence tracking) is read from
 * `mcpContextStorage` (AsyncLocalStorage).
 *
 * @param toolName  MCP tool name used in the `herramienta` log field
 * @param handler   Actual tool implementation
 */
export function withMcpLog<TInput extends Record<string, unknown>, TOutput>(
  toolName: string,
  handler: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const ctx = mcpContextStorage.getStore();
    const tsStart = Date.now();

    // sequence counter — 0 when no context (fallback mode)
    let seq = 0;
    if (ctx) {
      try {
        seq = ctx.nextSequence();
      } catch (limitErr) {
        // McpToolLimitExceededError — re-throw so the tool call is aborted
        throw limitErr;
      }
    }

    let output: TOutput | undefined;
    let estado: 'ok' | 'error' = 'error';
    let errorMessage: string | null = null;

    try {
      output = await handler(input);
      estado = 'ok';
      return output;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const durationMs = Date.now() - tsStart;
      const outputJson = output !== undefined ? JSON.stringify(output) : null;
      const isDebug = process.env.LOG_LEVEL === 'debug';

      mcpLog.info({
        event: 'mcp_tool_call',
        invocacionId: ctx?.invocacionId ?? 'unknown',
        gameId: ctx?.gameId ?? 'unknown',
        teamId: ctx?.teamId ?? 'unknown',
        turnoId: ctx?.turnoId ?? 'unknown',
        herramienta: toolName,
        secuencia: seq,
        estado,
        durationMs,
        errorMessage,
        outputHash: outputJson ? hashSHA256(outputJson) : null,
        ...(isDebug && {
          inputPayload: input,
          outputPayload: output ?? null,
        }),
      });
    }
  };
}
