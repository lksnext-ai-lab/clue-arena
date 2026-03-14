/**
 * GET /api/training/games/[id] — Full detail of a training game
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import { deleteTrainingGame } from '@/lib/game/training-service';
import { AppError } from '@/lib/utils/errors';
import { initGame } from '@/lib/game/engine';

function buildSeedNumber(seed: string | null): number {
  const seedStr = seed ?? '';
  return seedStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

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

  const botIds = Array.from({ length: row.numBots }, (_, index) => `bot-${index + 1}`);
  const initialState = initGame([row.equipoId, ...botIds], buildSeedNumber(row.seed ?? null));

  const botHands = Object.fromEntries(
    initialState.equipos
      .filter((equipo) => equipo.equipoId.startsWith('bot-'))
      .map((equipo) => [equipo.equipoId, equipo.cartas]),
  );

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
    botHands,
    motivoAbort: row.motivoAbort ?? null,
    createdAt: row.createdAt?.toISOString() ?? '',
    finishedAt: row.finishedAt?.toISOString() ?? null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'equipo') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const teamId = session.user.equipo?.id;
  if (!teamId) {
    return NextResponse.json({ error: 'Equipo no configurado' }, { status: 400 });
  }

  try {
    const result = await deleteTrainingGame({ gameId: id, teamId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    throw error;
  }
}
