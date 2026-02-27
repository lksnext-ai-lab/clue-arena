/**
 * POST /api/games/{id}/run
 *
 * Starts automatic execution of game turns (fire-and-forget).
 * Sets `modoEjecucion = 'auto'` and launches the auto-run loop in the
 * background without awaiting it.
 *
 * Returns 202 Accepted immediately.
 *
 * Body (optional): { turnoDelayMs?: number }
 *
 * Idempotency: if an auto-run loop is already active (`autoRunActivoDesde`
 * is not null), returns 409 to prevent duplicate loops.
 *
 * Auth: admin only.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { gameRunner } from '@/lib/game/runner';
import { gameEventEmitter } from '@/lib/ws/GameEventEmitter';

const RunBodySchema = z.object({
  turnoDelayMs: z.number().int().min(0).max(60_000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Parse optional body
  let turnoDelayMs: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RunBodySchema.safeParse(body);
    if (parsed.success) turnoDelayMs = parsed.data.turnoDelayMs;
  } catch {
    // Body is optional; ignore parse errors
  }

  const partida = await db
    .select()
    .from(partidas)
    .where(eq(partidas.id, id))
    .get();

  if (!partida) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }
  if (partida.estado !== 'en_curso') {
    return NextResponse.json(
      { error: 'La partida no está en curso' },
      { status: 400 },
    );
  }
  if (partida.autoRunActivoDesde !== null || gameRunner.isRunning(id)) {
    return NextResponse.json(
      { error: 'Ya existe un bucle de auto-run activo para esta partida' },
      { status: 409 },
    );
  }

  const delay = turnoDelayMs ?? partida.turnoDelayMs;

  // Mark as auto and record start timestamp
  await db
    .update(partidas)
    .set({
      modoEjecucion: 'auto',
      turnoDelayMs: delay,
      autoRunActivoDesde: new Date(),
    })
    .where(eq(partidas.id, id));

  gameEventEmitter.emitTurnCompleted(id, {
    type: 'status_changed',
    gameId: id,
    payload: { nuevoEstado: 'en_curso' },
  });

  // Delegar al GameRunner (proceso servidor, fuera del ciclo HTTP)
  gameRunner.start(id, delay);

  return NextResponse.json(
    { success: true, modoEjecucion: 'auto', turnoDelayMs: delay },
    { status: 202 },
  );
}
