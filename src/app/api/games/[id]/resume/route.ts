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
import { and, eq, isNull } from 'drizzle-orm';
import { gameRunner } from '@/lib/game/runner';
import { toSqliteConflictError } from '@/lib/db/sqlite-errors';
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

  let result:
    | { kind: 'started'; delay: number }
    | { kind: 'not_found' }
    | { kind: 'invalid_state' }
    | { kind: 'invalid_mode'; modo: string }
    | { kind: 'conflict' };

  try {
    result = db.transaction((tx) => {
      const partida = tx
        .select()
        .from(partidas)
        .where(eq(partidas.id, id))
        .get();

      if (!partida) {
        return { kind: 'not_found' } as const;
      }
      if (partida.estado !== 'en_curso') {
        return { kind: 'invalid_state' } as const;
      }
      if (partida.modoEjecucion !== 'pausado') {
        return { kind: 'invalid_mode', modo: partida.modoEjecucion } as const;
      }

      const delay = turnoDelayMs ?? partida.turnoDelayMs;
      const updateResult = tx
        .update(partidas)
        .set({
          modoEjecucion: 'auto',
          turnoDelayMs: delay,
          autoRunActivoDesde: new Date(),
        })
        .where(
          and(
            eq(partidas.id, id),
            eq(partidas.estado, 'en_curso'),
            eq(partidas.modoEjecucion, 'pausado'),
            isNull(partidas.autoRunActivoDesde),
          ),
        )
        .run();

      if (updateResult.changes === 0) {
        return { kind: 'conflict' } as const;
      }

      tx.update(partidaEquipos)
        .set({ warnings: 0 })
        .where(eq(partidaEquipos.partidaId, id))
        .run();

      return { kind: 'started', delay } as const;
    });
  } catch (error) {
    const conflict = toSqliteConflictError(
      error,
      'Ya existe una mutación en curso para esta partida',
      'GAME_MUTATION_IN_PROGRESS',
    );
    if (conflict) {
      return NextResponse.json(
        { error: conflict.message, code: conflict.code },
        { status: conflict.statusCode },
      );
    }
    throw error;
  }

  if (result.kind === 'not_found') {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }
  if (result.kind === 'invalid_state') {
    return NextResponse.json(
      { error: 'La partida no está en curso' },
      { status: 400 },
    );
  }
  if (result.kind === 'invalid_mode') {
    return NextResponse.json(
      { error: `La partida no está pausada (modo actual: ${result.modo})` },
      { status: 400 },
    );
  }
  if (result.kind === 'conflict' || gameRunner.isRunning(id)) {
    if (result.kind !== 'conflict') {
      await db
        .update(partidas)
        .set({ autoRunActivoDesde: null, modoEjecucion: 'pausado' })
        .where(eq(partidas.id, id));
    }
    return NextResponse.json(
      {
        error: 'Ya existe un bucle de auto-run activo o una mutación en curso para esta partida',
        code: 'GAME_MUTATION_IN_PROGRESS',
      },
      { status: 409 },
    );
  }

  // Notify connected clients that the game has resumed
  gameEventEmitter.emitTurnCompleted(id, {
    type: 'status_changed',
    gameId: id,
    payload: { nuevoEstado: 'en_curso' },
  });

  // Delegar al GameRunner (proceso servidor, fuera del ciclo HTTP)
  const runnerStarted = gameRunner.start(id, result.delay);
  if (!runnerStarted) {
    await db
      .update(partidas)
      .set({ autoRunActivoDesde: null, modoEjecucion: 'pausado' })
      .where(eq(partidas.id, id));

    return NextResponse.json(
      {
        error: 'Ya existe un bucle de auto-run activo o una mutación en curso para esta partida',
        code: 'GAME_MUTATION_IN_PROGRESS',
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { success: true, modoEjecucion: 'auto', turnoDelayMs: result.delay },
    { status: 202 },
  );
}
