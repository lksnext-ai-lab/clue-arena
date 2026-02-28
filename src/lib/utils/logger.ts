/**
 * F012 — Structured application logger (pino)
 *
 * Writes JSON lines to stdout. In development, also formats with pino-pretty.
 * In both environments, fan-outs each log line to the in-process LogEventEmitter
 * so the SSE endpoint (GET /api/admin/log/stream) can stream entries in real time.
 *
 * Node.js runtime only — do NOT import in Edge runtime (middleware).
 *
 * Exports:
 *  - logger     → root pino logger (service: 'clue-arena')
 *  - agentLog   → child logger for the coordinator ↔ agent cycle
 *  - mcpLog     → child logger for MCP tool calls
 */
import pino from 'pino';
import { Writable } from 'stream';
import { logEmitter } from './log-emitter';

const isDev = process.env.NODE_ENV === 'development';


// ── Emitter stream ──────────────────────────────────────────────────────────
// Parses each raw JSON line and re-emits it on the in-process EventEmitter so
// SSE clients receive real-time entries without any DB read.
const emitterStream = new Writable({
  write(chunk: Buffer, _encoding: BufferEncoding, cb: () => void) {
    try {
      const line = chunk.toString().trim();
      if (line) {
        const entry = JSON.parse(line) as Record<string, unknown>;
        logEmitter.emitLog(entry);
      }
    } catch {
      // Ignore parse errors (e.g. pino-pretty format lines)
    }
    cb();
  },
});

// ── Build the destination stream ────────────────────────────────────────────
// In dev we use pino-pretty as a direct in-process Transform (no worker
// thread). Using pino.transport({ target: 'pino-pretty' }) spawns a worker
// thread that can exit independently and makes every subsequent .info() call
// throw "the worker has exited", crashing the process.
function buildStream(): pino.DestinationStream {
  if (isDev) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PinoPretty = require('pino-pretty') as (opts: Record<string, unknown>) => Writable;
      const prettyStream = PinoPretty({ colorize: true }); // writes to stdout by default
      return pino.multistream([{ stream: prettyStream }, { stream: emitterStream }]);
    } catch {
      // pino-pretty not installed — fall back to plain stdout
    }
  }
  // Production: raw JSON to stdout (fd 1) + fan-out to emitter
  return pino.multistream([
    { stream: pino.destination(1) },
    { stream: emitterStream },
  ]);
}

// ── Root logger ─────────────────────────────────────────────────────────────
export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: 'clue-arena' },
  },
  buildStream(),
);

// ── Child loggers by component ───────────────────────────────────────────────
/** Logger for the coordinator ↔ agent invocation cycle (F012 §3.2) */
export const agentLog = logger.child({ component: 'agent-coordinator' });

/** Logger for MCP tool calls (F012 §3.2) */
export const mcpLog = logger.child({ component: 'mcp-tools' });

/** Logger for the Genkit local-backend LLM calls (F012 §4.4) */
export const genkitLog = logger.child({ component: 'genkit-local' });
