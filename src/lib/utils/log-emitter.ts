/**
 * F012 — Log EventEmitter singleton
 *
 * Provides an in-process fan-out channel so the pino logger can push structured
 * log entries to SSE clients (GET /api/admin/log/stream) without any DB storage.
 *
 * Node.js runtime only — do NOT import in Edge runtime.
 */
import { EventEmitter } from 'events';
import type { InteractionLogEntry } from './log-types';

class LogEventEmitter extends EventEmitter {
  emitLog(entry: Record<string, unknown>): void {
    this.emit('log', entry);
  }
}

/**
 * Singleton: shared across the Node.js process lifetime.
 * Max 50 SSE listeners (generous for a single-event setup).
 */
export const logEmitter = new LogEventEmitter();
logEmitter.setMaxListeners(50);

// Typed helper for consumers
export type LogEntryPayload = InteractionLogEntry & Record<string, unknown>;
