/**
 * GET /api/training/games/[id] — Full detail of a training game
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || (session.user.rol !== 'equipo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const row = await db
    .select()
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  // RBAC: equipo can only see own games
  if (session.user.rol === 'equipo' && session.user.equipo?.id !== row.equipoId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const [{ total: numTurnos }] = await db
    .select({ total: count() })
    .from(turnosEntrenamiento)
    .where(eq(turnosEntrenamiento.partidaId, id));

  const resultado = row.resultadoJson
    ? (JSON.parse(row.resultadoJson) as { ganadorId: string | null; puntosSimulados: number; turnosJugados: number })
    : null;

  const sobres = row.sobresJson
    ? JSON.parse(row.sobresJson) as { sospechoso: string; arma: string; habitacion: string }
    : null;

  return NextResponse.json({
    id: row.id,
    equipoId: row.equipoId,
    estado: row.estado,
    numBots: row.numBots,
    seed: row.seed ?? null,
    numTurnos,
    ganador: resultado?.ganadorId ?? null,
    sobres,
    resultado,
    motivoAbort: row.motivoAbort ?? null,
    createdAt: row.createdAt?.toISOString() ?? '',
    finishedAt: row.finishedAt?.toISOString() ?? null,
  });
}
