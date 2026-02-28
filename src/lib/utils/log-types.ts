/**
 * F012 — Log de Interacción Coordinador-Agente
 * TypeScript types for structured log entries emitted by the pino logger.
 *
 * All events share a set of base fields (invocacionId, gameId, teamId, turnoId)
 * for correlation across a single agent invocation cycle.
 */

/** Common fields present in every interaction log event. */
export interface BaseLogEntry {
  event: string;
  /** UUID v4 — correlation key for a complete invocation cycle */
  invocacionId: string;
  gameId: string;
  teamId: string;
  turnoId: string;
}

// ─── Agent invocation cycle ──────────────────────────────────────────────────

export interface AgentInvocationStartLog extends BaseLogEntry {
  event: 'agent_invocation_start';
  tipo: 'play_turn' | 'refute';
  agentBackend: 'mattin' | 'local' | 'unknown';
  /** SHA-256 of the GameStateView sent to the agent; null when unavailable */
  gameStateViewHash: string | null;
}

export interface AgentInvocationCompleteLog extends BaseLogEntry {
  event: 'agent_invocation_complete';
  estado: 'completada' | 'timeout' | 'error';
  durationMs: number;
  /**
   * null = not yet validated (should not happen).
   * Validation result is emitted in a separate agent_response_validation event.
   */
  responseValid: boolean | null;
  validationError: string | null;
  errorMessage: string | null;
  /** Type of action taken — not the full payload (strategy stays private). */
  actionType: 'suggestion' | 'accusation' | 'show_card' | 'cannot_refute' | null;
}

export interface AgentResponseValidationLog extends BaseLogEntry {
  event: 'agent_response_validation';
  responseValid: boolean;
  validationError: string | null;
}

// ─── MCP tool calls ──────────────────────────────────────────────────────────

export interface McpToolCallLog extends BaseLogEntry {
  event: 'mcp_tool_call';
  herramienta: string;
  /** 1-based call order within the same invocacion */
  secuencia: number;
  estado: 'ok' | 'error';
  durationMs: number;
  errorMessage: string | null;
  /**
   * SHA-256(JSON.stringify(output)) for integrity verification.
   * null when output is unavailable (error path).
   */
  outputHash: string | null;
  // inputPayload and outputPayload are only included at LOG_LEVEL=debug
  inputPayload?: unknown;
  outputPayload?: unknown;
}

// ─── MCP tool limit exceeded ─────────────────────────────────────────────────

export interface McpToolLimitLog extends BaseLogEntry {
  event: 'mcp_tool_limit_exceeded';
  herramienta: string;
  /** Sequence number that triggered the limit */
  secuencia: number;
}

// ─── Genkit local backend — LLM request / response (F012 §3.3) ───────────────

/**
 * Emitted immediately before `ai.generate()` is called in the local backend.
 * Captures the model, request type, and hashes of both prompts.
 * At LOG_LEVEL=debug the raw prompts are also included (may contain game state).
 */
export interface GenkitLlmRequestLog extends BaseLogEntry {
  event: 'genkit_llm_request';
  /** Genkit model identifier, e.g. 'googleai/gemini-2.0-flash-exp' */
  model: string;
  tipo: 'play_turn' | 'refute';
  /** SHA-256 of the active system prompt — identifies prompt version without exposing content */
  systemPromptHash: string;
  /** SHA-256 of the full user prompt including injected game-state context */
  userPromptHash: string;
  outputFormat: 'json';
  // Only included at LOG_LEVEL=debug (may contain team cards / game state):
  systemPrompt?: string;
  userPrompt?: string;
}

/**
 * Emitted after `ai.generate()` resolves **and** Zod schema validation completes.
 * `estado` distinguishes network/API failures from well-formed but schema-invalid responses.
 * At LOG_LEVEL=debug the raw LLM response text is also included.
 */
export interface GenkitLlmResponseLog extends BaseLogEntry {
  event: 'genkit_llm_response';
  model: string;
  tipo: 'play_turn' | 'refute';
  /** 'ok' = valid response; 'parse_error' = LLM responded but JSON fails Zod; 'error' = API/network failure */
  estado: 'ok' | 'error' | 'parse_error';
  /** Wall-clock ms from just before ai.generate() until after Zod validation */
  durationMs: number;
  /** LLM finish reason: 'stop', 'max-tokens', 'other', or null when unavailable */
  finishReason: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  tokensTotal: number | null;
  /** Number of messages in the response (normally 1 for single-turn; >1 if multi-turn) */
  messageCount: number;
  /** Whether the output passed Zod schema validation */
  outputValid: boolean;
  errorMessage: string | null;
  // Only included at LOG_LEVEL=debug (may contain agent reasoning / strategy):
  responseText?: string | null;
}

export type InteractionLogEntry =
  | AgentInvocationStartLog
  | AgentInvocationCompleteLog
  | AgentResponseValidationLog
  | McpToolCallLog
  | McpToolLimitLog
  | GenkitLlmRequestLog
  | GenkitLlmResponseLog;
