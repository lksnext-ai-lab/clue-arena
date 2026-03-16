/**
 * GET  /api/training/games — List training games for the authenticated team
 * POST /api/training/games — Create + run a new training game
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento, equipos } from '@/lib/db/schema';
import { and, desc, eq, count, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CreateTrainingGameSchema } from '@/lib/schemas/training';
import { trainingRunner } from '@/lib/game/training-runner';
import { toSqliteConflictError } from '@/lib/db/sqlite-errors';

const MAX_HISTORY = 20;
const RATE_LIMIT_MS = 60_000; // 60 s between games

async function getActiveTrainingGameId(equipoId: string): Promise<string | null> {
  const activeGame = await db
    .select({ id: partidasEntrenamiento.id })
    .from(partidasEntrenamiento)
    .where(
      and(
        eq(partidasEntrenamiento.equipoId, equipoId),
        eq(partidasEntrenamiento.estado, 'en_curso'),
      ),
    )
    .limit(1)
    .get();

  return activeGame?.id ?? null;
}

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
  const { numBots, maxTurnos, seed } = parsed.data;

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

  let createResult:
    | {
        kind: 'created';
        gameId: string;
        resolvedSeed: string;
        agentBackend: 'mattin' | 'local';
        mattinAgentId?: string;
        mattinAppId?: string;
        mattinApiKey?: string;
      }
    | { kind: 'team_not_found' };

  try {
    createResult = db.transaction((tx) => {
      const equipoRow = tx
        .select({
          agentBackend: equipos.agentBackend,
          agentId: equipos.agentId,
          appId: equipos.appId,
          mattinApiKey: equipos.mattinApiKey,
        })
        .from(equipos)
        .where(eq(equipos.id, equipoId))
        .get();

      if (!equipoRow) {
        return { kind: 'team_not_found' } as const;
      }

      const histCountRow = tx
        .select({ total: count() })
        .from(partidasEntrenamiento)
        .where(eq(partidasEntrenamiento.equipoId, equipoId))
        .get();
      const histCount = histCountRow?.total ?? 0;

      if (histCount >= MAX_HISTORY) {
        const oldestFinished = tx
          .select({ id: partidasEntrenamiento.id })
          .from(partidasEntrenamiento)
          .where(
            and(
              eq(partidasEntrenamiento.equipoId, equipoId),
              inArray(partidasEntrenamiento.estado, ['finalizada', 'abortada']),
            ),
          )
          .orderBy(partidasEntrenamiento.createdAt)
          .limit(1)
          .get();

        if (oldestFinished) {
          tx.delete(partidasEntrenamiento)
            .where(eq(partidasEntrenamiento.id, oldestFinished.id))
            .run();
        }
      }

      const gameId = uuidv4();
      const resolvedSeed = seed ?? uuidv4();

      tx.insert(partidasEntrenamiento)
        .values({
          id: gameId,
          equipoId,
          estado: 'en_curso',
          numBots,
          maxTurnos,
          seed: resolvedSeed,
          createdAt: new Date(),
        })
        .run();

      return {
        kind: 'created',
        gameId,
        resolvedSeed,
        agentBackend: equipoRow.agentBackend as 'mattin' | 'local',
        mattinAgentId: equipoRow.agentId ?? undefined,
        mattinAppId: equipoRow.appId ?? undefined,
        mattinApiKey: equipoRow.mattinApiKey ?? undefined,
      } as const;
    });
  } catch (error) {
    const conflict = toSqliteConflictError(
      error,
      'Ya existe una partida de entrenamiento en curso para este equipo',
      'TRAINING_GAME_IN_PROGRESS',
    );
    if (conflict) {
      const activeGameId = await getActiveTrainingGameId(equipoId);
      return NextResponse.json(
        {
          error: conflict.code,
          code: conflict.code,
          activeGameId,
        },
        { status: conflict.statusCode },
      );
    }
    throw error;
  }

  if (createResult.kind === 'team_not_found') {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  // Kick off the game loop in the background (after the response is sent).
  // The client navigates to the detail page immediately and polls for updates.
  after(async () => {
    const runnerStarted = trainingRunner.start({
      gameId: createResult.gameId,
      equipoId,
      numBots,
      maxTurnos,
      seed: createResult.resolvedSeed,
      agentBackend: createResult.agentBackend,
      mattinAgentId: createResult.mattinAgentId,
      mattinAppId: createResult.mattinAppId,
      mattinApiKey: createResult.mattinApiKey,
    });

    if (!runnerStarted) {
      await db
        .update(partidasEntrenamiento)
        .set({
          estado: 'abortada',
          motivoAbort: 'TRAINING_GAME_IN_PROGRESS',
          finishedAt: new Date(),
        })
        .where(eq(partidasEntrenamiento.id, createResult.gameId));
    }
  });

  return NextResponse.json({ id: createResult.gameId }, { status: 202 });
}
