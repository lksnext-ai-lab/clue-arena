/**
 * POST /api/games/{id}/resume
 *
 * Resumes the auto-run loop after a pause.
 * Sets `modoEjecucion = 'auto'`, records `autoRunActivoDesde = now()`,
 * and re-launches the fire-and-forget loop.
 *
 * Returns 202 Accepted.
 * Body (optional): { turnoDelayMs?: number }
 * Auth: admin only.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas, partidaEquipos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { gameRunner } from '@/lib/game/runner';
import { gameEventEmitter } from '@/lib/ws/GameEventEmitter';

const ResumeBodySchema = z.object({
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
    const parsed = ResumeBodySchema.safeParse(body);
    if (parsed.success) turnoDelayMs = parsed.data.turnoDelayMs;
  } catch {
    // Body is optional
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
  if (partida.modoEjecucion !== 'pausado') {
    return NextResponse.json(
      { error: `La partida no está pausada (modo actual: ${partida.modoEjecucion})` },
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

  await db
    .update(partidas)
    .set({
      modoEjecucion: 'auto',
      turnoDelayMs: delay,
      autoRunActivoDesde: new Date(),
    })
    .where(eq(partidas.id, id));

  // Notify connected clients that the game has resumed
  gameEventEmitter.emitTurnCompleted(id, {
    type: 'status_changed',
    gameId: id,
    payload: { nuevoEstado: 'en_curso' },
  });

  // Delegar al GameRunner (proceso servidor, fuera del ciclo HTTP)
  // G006: reset warning counters on resume (§3.2)
  await db
    .update(partidaEquipos)
    .set({ warnings: 0 })
    .where(eq(partidaEquipos.partidaId, id));

  gameRunner.start(id, delay);

  return NextResponse.json(
    { success: true, modoEjecucion: 'auto', turnoDelayMs: delay },
    { status: 202 },
  );
}
