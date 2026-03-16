/**
 * POST /api/games/:id/start
 *
 * Starts a pending game.
 * Body (optional): { "modo": "auto" | "manual", "turnoDelayMs": number }
 * Defaults: modo="manual", turnoDelayMs=3000.
 *
 * If modo="auto": also fires startAutoRun (fire-and-forget).
 * Auth: admin only.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, equipos, turnos } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { gameRunner } from '@/lib/game/runner';
import { toSqliteConflictError } from '@/lib/db/sqlite-errors';
import { gameEventEmitter } from '@/lib/ws/GameEventEmitter';
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';

const StartBodySchema = z.object({
  modo: z.enum(['auto', 'manual']).optional().default('manual'),
  turnoDelayMs: z.number().int().min(0).max(60_000).optional(),
});

// POST /api/games/:id/start
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Parse optional body
  let modo: 'auto' | 'manual' = 'manual';
  let turnoDelayMs: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = StartBodySchema.safeParse(body);
    if (parsed.success) {
      modo = parsed.data.modo;
      turnoDelayMs = parsed.data.turnoDelayMs;
    }
  } catch {
    // Body is optional
  }

  let result:
    | {
        kind: 'started';
        nombre: string;
        startedAt: Date;
        delay: number;
      }
    | { kind: 'not_found' }
    | { kind: 'invalid_state' }
    | { kind: 'conflict' };

  try {
    result = db.transaction((tx) => {
      const partida = tx.select().from(partidas).where(eq(partidas.id, id)).get();
      if (!partida) {
        return { kind: 'not_found' } as const;
      }

      if (partida.estado !== 'pendiente') {
        return { kind: 'invalid_state' } as const;
      }

      const gameTeams = tx
        .select({ pe: partidaEquipos, e: equipos })
        .from(partidaEquipos)
        .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
        .where(eq(partidaEquipos.partidaId, id))
        .all()
        .sort((a, b) => a.pe.orden - b.pe.orden);

      const delay = turnoDelayMs ?? partida.turnoDelayMs ?? 3000;
      const now = new Date();
      const updateResult = tx
        .update(partidas)
        .set({
          estado: 'en_curso',
          startedAt: now,
          turnoActual: 0,
          modoEjecucion: modo,
          turnoDelayMs: delay,
          autoRunActivoDesde: modo === 'auto' ? now : null,
        })
        .where(and(eq(partidas.id, id), eq(partidas.estado, 'pendiente')))
        .run();

      if (updateResult.changes === 0) {
        return { kind: 'conflict' } as const;
      }

      if (gameTeams.length > 0) {
        tx.insert(turnos)
          .values({
            id: uuidv4(),
            partidaId: id,
            equipoId: gameTeams[0].pe.equipoId,
            numero: 1,
            estado: 'en_curso',
            startedAt: now,
          })
          .run();
      }

      return {
        kind: 'started',
        nombre: partida.nombre,
        startedAt: now,
        delay,
      } as const;
    });
  } catch (error) {
    const conflict = toSqliteConflictError(
      error,
      'Ya existe otra mutación en curso para esta partida',
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
      { error: 'La partida no está en estado pendiente' },
      { status: 409 },
    );
  }

  if (result.kind === 'conflict') {
    return NextResponse.json(
      {
        error: 'Ya existe otra mutación en curso para esta partida',
        code: 'GAME_MUTATION_IN_PROGRESS',
      },
      { status: 409 },
    );
  }

  // Notify connected clients that the game has started
  gameEventEmitter.emitTurnCompleted(id, {
    type: 'status_changed',
    gameId: id,
    payload: { nuevoEstado: 'en_curso' },
  });

  // F018: push global notification to all users
  notificationEmitter.emitGlobal({
    type: 'notification:game_started',
    gameId: id,
    nombre: result.nombre,
    ts: Date.now(),
  });

  // Si es modo auto, delegar al GameRunner (proceso servidor, fuera del ciclo HTTP)
  if (modo === 'auto') {
    const runnerStarted = gameRunner.start(id, result.delay);
    if (!runnerStarted) {
      await db
        .update(partidas)
        .set({ modoEjecucion: 'manual', autoRunActivoDesde: null })
        .where(eq(partidas.id, id));

      return NextResponse.json(
        {
          error: 'La partida se ha iniciado, pero no se ha podido activar el auto-run',
          code: 'GAME_MUTATION_IN_PROGRESS',
        },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({
    id,
    estado: 'en_curso',
    modoEjecucion: modo,
    iniciadaAt: result.startedAt.toISOString(),
  });
}
