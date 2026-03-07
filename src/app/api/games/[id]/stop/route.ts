/**
 * POST /api/games/:id/stop
 *
 * Manually finishes a game in any non-final state.
 *
 * - Idempotent: if already `finalizada` → 200.
 * - Sets `modoEjecucion = 'manual'` first so any running auto-run loop stops.
 * - Closes active turns with `estado = 'interrumpido'`.
 * - Persists `finishedAt`.
 *
 * Auth: admin only.
 */

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas, turnos, sobres } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { gameRunner } from '@/lib/game/runner';
import { gameEventEmitter } from '@/lib/ws/GameEventEmitter';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';

// POST /api/games/:id/stop
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const partida = await db.select().from(partidas).where(eq(partidas.id, id)).get();
  if (!partida) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  // Idempotent: already finished
  if (partida.estado === 'finalizada') {
    const sobre = await db.select().from(sobres).where(eq(sobres.partidaId, id)).get();
    return NextResponse.json({
      id,
      estado: 'finalizada',
      sobre: sobre
        ? { sospechoso: sobre.sospechoso, arma: sobre.arma, habitacion: sobre.habitacion }
        : undefined,
    });
  }

  if (partida.estado === 'pendiente') {
    return NextResponse.json(
      { error: 'La partida está pendiente; no se puede detener. Elimínala si procede.' },
      { status: 409 },
    );
  }

  const now = new Date();

  // Señalizar al GameRunner para que aborte el loop inmediatamente (cancela el sleep inter-turno)
  gameRunner.stop(id);

  // Set modoEjecucion=manual so the loop exits if it re-checks before receiving the abort signal
  await db
    .update(partidas)
    .set({ modoEjecucion: 'manual' })
    .where(eq(partidas.id, id));

  // Interrupt active turns
  const activeTurns = await db
    .select()
    .from(turnos)
    .where(and(eq(turnos.partidaId, id), eq(turnos.estado, 'en_curso')))
    .all();

  for (const turn of activeTurns) {
    await db
      .update(turnos)
      .set({ estado: 'interrumpido', finishedAt: now })
      .where(eq(turnos.id, turn.id));
  }

  // Mark game as finished
  await db
    .update(partidas)
    .set({ estado: 'finalizada', finishedAt: now })
    .where(eq(partidas.id, id));

  gameEventEmitter.emitTurnCompleted(id, {
    type: 'status_changed',
    gameId: id,
    payload: { nuevoEstado: 'finalizada' },
  });

  // F018: notify all users that the game ended and ranking may have changed
  notificationEmitter.emitGlobal({
    type: 'notification:game_finished',
    gameId: id,
    nombre: partida.nombre,
    ganadorId: null,        // admin-stopped games have no winner
    ganadorNombre: null,
    ts: Date.now(),
  });
  notificationEmitter.emitGlobal({ type: 'notification:ranking_updated', ts: Date.now() });

  const sobre = await db.select().from(sobres).where(eq(sobres.partidaId, id)).get();

  return NextResponse.json({
    id,
    estado: 'finalizada',
    sobre: sobre
      ? { sospechoso: sobre.sospechoso, arma: sobre.arma, habitacion: sobre.habitacion }
      : undefined,
  });
}
