/**
 * Training turn interceptor (F015).
 *
 * In-memory singleton used exclusively during training game execution.
 * Records AgentToolCall entries for the active training turn so that
 * invokeAgentWithTrace can assemble an AgentInteractionTrace.
 *
 * Lifecycle per turn:
 *   1. beginTurnCapture(trainingTurnId)
 *   2. … agent runs, tool calls arrive via recordToolCall() …
 *   3. const calls = endTurnCapture()
 *
 * Thread-safety: training game execution is synchronous within a single
 * Next.js Route Handler invocation, so the singleton is safe.
 */

import type { AgentToolCall } from '@/types/api';

let activeTurnId: string | null = null;
let capturedCalls: AgentToolCall[] = [];

/** Activates call capture for a training turn. */
export function beginTurnCapture(trainingTurnId: string): void {
  activeTurnId = trainingTurnId;
  capturedCalls = [];
}

/** Records an intercepted tool call. Called from the /api/mcp handler or agent wrappers. */
export function recordToolCall(call: AgentToolCall): void {
  if (activeTurnId !== null) {
    capturedCalls.push(call);
  }
}

/** Returns current capture session turn ID, or null when inactive. */
export function getActiveTurnId(): string | null {
  return activeTurnId;
}

/** Stops capture and returns all accumulated tool calls. */
export function endTurnCapture(): AgentToolCall[] {
  const result = [...capturedCalls];
  activeTurnId = null;
  capturedCalls = [];
  return result;
}
