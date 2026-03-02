/**
 * GET  /api/training/games — List training games for the authenticated team
 * POST /api/training/games — Create + run a new training game
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CreateTrainingGameSchema } from '@/lib/schemas/training';
import {
  runTrainingGameLoop,
  countActiveTrainingGames,
  countTotalTrainingGames,
} from '@/lib/game/training-loop';

const MAX_HISTORY = 20;
const RATE_LIMIT_MS = 60_000; // 60 s between games

// ---------------------------------------------------------------------------
// GET /api/training/games
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user || (session.user.rol !== 'equipo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Admin sees all; equipo sees only own games
  const teamId = session.user.rol === 'equipo' ? session.user.equipo?.id : null;
  if (session.user.rol === 'equipo' && !teamId) {
    return NextResponse.json({ error: 'Equipo no configurado' }, { status: 400 });
  }

  const rows = teamId
    ? await db
        .select()
        .from(partidasEntrenamiento)
        .where(eq(partidasEntrenamiento.equipoId, teamId))
        .orderBy(desc(partidasEntrenamiento.createdAt))
        .limit(MAX_HISTORY)
        .all()
    : await db
        .select()
        .from(partidasEntrenamiento)
        .orderBy(desc(partidasEntrenamiento.createdAt))
        .limit(MAX_HISTORY)
        .all();

  // Enrich with turn count
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [{ total: numTurnos }] = await db
        .select({ total: count() })
        .from(turnosEntrenamiento)
        .where(eq(turnosEntrenamiento.partidaId, row.id));

      const resultado = row.resultadoJson
        ? (JSON.parse(row.resultadoJson) as { ganadorId: string | null; puntosSimulados: number; turnosJugados: number })
        : null;

      return {
        id: row.id,
        equipoId: row.equipoId,
        estado: row.estado,
        numBots: row.numBots,
        seed: row.seed ?? null,
        numTurnos,
        ganador: resultado?.ganadorId ?? null,
        sobres: (row.estado !== 'en_curso' && row.sobresJson)
          ? JSON.parse(row.sobresJson) as { sospechoso: string; arma: string; habitacion: string }
          : null,
        resultado,
        motivoAbort: row.motivoAbort ?? null,
        createdAt: row.createdAt?.toISOString() ?? '',
        finishedAt: row.finishedAt?.toISOString() ?? null,
      };
    }),
  );

  return NextResponse.json({ games: enriched });
}

// ---------------------------------------------------------------------------
// POST /api/training/games
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'equipo') {
    return NextResponse.json({ error: 'Solo los equipos pueden crear partidas de entrenamiento' }, { status: 403 });
  }

  const equipoId = session.user.equipo?.id;
  if (!equipoId) {
    return NextResponse.json({ error: 'Equipo no configurado en la sesión' }, { status: 400 });
  }

  // Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = CreateTrainingGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const { numBots, seed } = parsed.data;

  // Rate limiting: enforce 60 s between game creations
  const recentGames = await db
    .select({ createdAt: partidasEntrenamiento.createdAt })
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.equipoId, equipoId))
    .orderBy(desc(partidasEntrenamiento.createdAt))
    .limit(1)
    .all();

  if (recentGames.length > 0 && recentGames[0].createdAt) {
    const elapsed = Date.now() - recentGames[0].createdAt.getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfterSeconds: retryAfter },
        { status: 429 },
      );
    }
  }

  // Concurrent game check
  const activeCount = await countActiveTrainingGames(equipoId);
  if (activeCount > 0) {
    const activeGame = await db
      .select({ id: partidasEntrenamiento.id })
      .from(partidasEntrenamiento)
      .where(eq(partidasEntrenamiento.equipoId, equipoId))
      .limit(1)
      .get();
    return NextResponse.json(
      { error: 'TRAINING_GAME_IN_PROGRESS', activeGameId: activeGame?.id ?? null },
      { status: 409 },
    );
  }

  // History cap
  const histCount = await countTotalTrainingGames(equipoId);
  if (histCount >= MAX_HISTORY) {
    // Delete oldest to make room
    const oldest = await db
      .select({ id: partidasEntrenamiento.id })
      .from(partidasEntrenamiento)
      .where(eq(partidasEntrenamiento.equipoId, equipoId))
      .orderBy(partidasEntrenamiento.createdAt)
      .limit(1)
      .get();
    if (oldest) {
      await db.delete(partidasEntrenamiento).where(eq(partidasEntrenamiento.id, oldest.id));
    }
  }

  // Create row first so loop can update it
  const gameId = uuidv4();
  const resolvedSeed = seed ?? uuidv4();

  await db.insert(partidasEntrenamiento).values({
    id: gameId,
    equipoId,
    estado: 'en_curso',
    numBots,
    seed: resolvedSeed,
    createdAt: new Date(),
  });

  // Kick off the game loop in the background (after the response is sent).
  // The client navigates to the detail page immediately and polls for updates.
  after(async () => {
    try {
      await runTrainingGameLoop({ gameId, equipoId, numBots, seed: resolvedSeed });
    } catch (err) {
      await db
        .update(partidasEntrenamiento)
        .set({
          estado: 'abortada',
          motivoAbort: err instanceof Error ? err.message : 'unknown',
          finishedAt: new Date(),
        })
        .where(eq(partidasEntrenamiento.id, gameId));
    }
  });

  return NextResponse.json({ id: gameId }, { status: 202 });
}
