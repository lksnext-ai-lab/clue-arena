/**
 * F012 §4.4 — Genkit local-backend structured logging helpers.
 *
 * Provides two thin wrappers that emit `genkit_llm_request` and
 * `genkit_llm_response` log events via the shared pino logger.
 *
 * Usage in local-agent.ts:
 *
 *   const systemPrompt = ...;
 *   const userPrompt   = ...;
 *   logGenkitRequest({ invocacionId, gameId, teamId, turnoId, model, tipo,
 *                      systemPrompt, userPrompt });
 *
 *   const tsLlm = Date.now();
 *   try {
 *     response = await ai.generate(...);
 *   } catch (err) {
 *     logGenkitResponse({ ..., estado: 'error', durationMs: Date.now() - tsLlm,
 *                          messageCount: 0, outputValid: false, errorMessage: ... });
 *     throw err;
 *   }
 *   const parsed = schema.safeParse(response.output);
 *   logGenkitResponse({ ...,
 *     estado: parsed.success ? 'ok' : 'parse_error',
 *     durationMs: Date.now() - tsLlm,
 *     finishReason: response.finishReason ?? null,
 *     tokensInput:  response.usage?.inputTokens  ?? null,
 *     tokensOutput: response.usage?.outputTokens ?? null,
 *     tokensTotal:  response.usage?.totalTokens  ?? null,
 *     messageCount: response.messages.length,
 *     outputValid:  parsed.success,
 *     errorMessage: parsed.success ? null : parsed.error.message,
 *     responseText: response.text ?? null,   // debug only
 *   });
 *
 * Node.js runtime only — do NOT import in Edge runtime (middleware).
 */

import { genkitLog } from '@/lib/utils/logger';
import { hashSHA256 } from '@/lib/utils/crypto';
import type { GenkitLlmRequestLog, GenkitLlmResponseLog } from '@/lib/utils/log-types';

// ---------------------------------------------------------------------------
// logGenkitRequest
// ---------------------------------------------------------------------------

export interface LogGenkitRequestParams {
  invocacionId: string;
  gameId: string;
  teamId: string;
  turnoId: string;
  /** Genkit model identifier, e.g. 'googleai/gemini-2.0-flash-exp' */
  model: string;
  tipo: 'play_turn' | 'refute';
  /** System prompt string — hashed in the log; raw only at LOG_LEVEL=debug */
  systemPrompt: string;
  /** User prompt string (includes injected game context) — hashed in the log; raw only at debug */
  userPrompt: string;
}

/**
 * Emit a `genkit_llm_request` event.
 * Call this immediately before `ai.generate()`.
 */
export function logGenkitRequest(params: LogGenkitRequestParams): void {
  const entry: Omit<GenkitLlmRequestLog, 'event'> & { event: 'genkit_llm_request' } = {
    event: 'genkit_llm_request',
    invocacionId: params.invocacionId,
    gameId: params.gameId,
    teamId: params.teamId,
    turnoId: params.turnoId,
    model: params.model,
    tipo: params.tipo,
    systemPromptHash: hashSHA256(params.systemPrompt),
    userPromptHash: hashSHA256(params.userPrompt),
    outputFormat: 'json',
  };

  if (process.env.LOG_LEVEL === 'debug') {
    // RISK: userPrompt contains the filtered GameStateView (team cards).
    // Only log raw prompts under explicit debug mode — never in production.
    (entry as GenkitLlmRequestLog).systemPrompt = params.systemPrompt;
    (entry as GenkitLlmRequestLog).userPrompt = params.userPrompt;
  }

  genkitLog.info(entry);
}

// ---------------------------------------------------------------------------
// logGenkitResponse
// ---------------------------------------------------------------------------

export interface LogGenkitResponseParams {
  invocacionId: string;
  gameId: string;
  teamId: string;
  turnoId: string;
  model: string;
  tipo: 'play_turn' | 'refute';
  durationMs: number;
  /** 'ok' | 'parse_error' (JSON invalid per Zod) | 'error' (API/network failure) */
  estado: 'ok' | 'error' | 'parse_error';
  finishReason: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  tokensTotal: number | null;
  messageCount: number;
  outputValid: boolean;
  errorMessage: string | null;
  /**
   * Raw LLM response text.
   * Only included in the log when LOG_LEVEL=debug (may contain agent reasoning).
   */
  responseText?: string | null;
}

/**
 * Emit a `genkit_llm_response` event.
 * Call this after Zod validation completes (both success and failure paths).
 */
export function logGenkitResponse(params: LogGenkitResponseParams): void {
  const entry: Omit<GenkitLlmResponseLog, 'event'> & { event: 'genkit_llm_response' } = {
    event: 'genkit_llm_response',
    invocacionId: params.invocacionId,
    gameId: params.gameId,
    teamId: params.teamId,
    turnoId: params.turnoId,
    model: params.model,
    tipo: params.tipo,
    estado: params.estado,
    durationMs: params.durationMs,
    finishReason: params.finishReason,
    tokensInput: params.tokensInput,
    tokensOutput: params.tokensOutput,
    tokensTotal: params.tokensTotal,
    messageCount: params.messageCount,
    outputValid: params.outputValid,
    errorMessage: params.errorMessage,
  };

  if (process.env.LOG_LEVEL === 'debug' && params.responseText != null) {
    // RISK: may contain agent strategy / internal reasoning.
    (entry as GenkitLlmResponseLog).responseText = params.responseText;
  }

  genkitLog.info(entry);
}
