/**
 * GET /api/training/games/[id]/turns/[turnoId]/trace
 * Returns the full AgentInteractionTrace for a specific training turn.
 * Only accessible by the owning equipo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; turnoId: string }> },
) {
  const { id, turnoId } = await params;
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'equipo') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const equipoId = session.user.equipo?.id;
  if (!equipoId) {
    return NextResponse.json({ error: 'Equipo no configurado' }, { status: 400 });
  }

  const game = await db
    .select({ equipoId: partidasEntrenamiento.equipoId })
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.id, id))
    .get();

  if (!game) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  if (game.equipoId !== equipoId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const turn = await db
    .select()
    .from(turnosEntrenamiento)
    .where(eq(turnosEntrenamiento.id, turnoId))
    .get();

  if (!turn || turn.partidaId !== id) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  if (turn.esBot || !turn.agentTrace) {
    return NextResponse.json({ error: 'Este turno no tiene traza de agente' }, { status: 404 });
  }

  return NextResponse.json({
    turnoId: turn.id,
    numero: turn.numero,
    trace: JSON.parse(turn.agentTrace),
    memoriaInicial: turn.memoriaInicial ? JSON.parse(turn.memoriaInicial) : null,
    memoriaFinal: turn.memoriaFinal ? JSON.parse(turn.memoriaFinal) : null,
    durationMs: turn.durationMs,
  });
}
