/**
 * F012 — Real-time log stream endpoint (SSE)
 *
 * GET /api/admin/log/stream?gameId={id}
 *
 * Streams structured interaction log entries to admin clients as they are
 * emitted by the pino logger (via LogEventEmitter). No DB reads — pure
 * in-process fan-out.
 *
 * Auth: admin role only.
 * Runtime: Node.js (NOT Edge — requires EventEmitter from log-emitter.ts).
 *
 * Query params:
 *   gameId  – optional; when provided only entries for that game are sent.
 */

import { type NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { logEmitter } from '@/lib/utils/log-emitter';

// Force Node.js runtime so we can use EventEmitter
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getAuthSession();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (session.user.rol !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  // ── Optional filter ───────────────────────────────────────────────────────
  const gameId = request.nextUrl.searchParams.get('gameId') ?? null;

  // ── SSE stream ────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send a heartbeat comment so the browser keeps the connection open
      controller.enqueue(encoder.encode(': connected\n\n'));

      function handler(entry: Record<string, unknown>): void {
        // Skip entries that don't match the requested game (when filter is set)
        if (gameId && entry.gameId !== gameId) return;

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
        } catch {
          // Stream may already be closed
          logEmitter.off('log', handler);
        }
      }

      logEmitter.on('log', handler);

      // Cleanup when the client disconnects
      request.signal.addEventListener('abort', () => {
        logEmitter.off('log', handler);
        try {
          controller.close();
        } catch {
          // Already closed — ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering if behind a proxy
    },
  });
}
