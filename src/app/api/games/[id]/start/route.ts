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
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { gameRunner } from '@/lib/game/runner';
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

  const partida = await db.select().from(partidas).where(eq(partidas.id, id)).get();
  if (!partida) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  if (partida.estado !== 'pendiente') {
    return NextResponse.json({ error: 'La partida no está en estado pendiente' }, { status: 409 });
  }

  // Get teams sorted by order
  const gameTeams = await db
    .select({ pe: partidaEquipos, e: equipos })
    .from(partidaEquipos)
    .innerJoin(equipos, eq(partidaEquipos.equipoId, equipos.id))
    .where(eq(partidaEquipos.partidaId, id))
    .all();

  gameTeams.sort((a, b) => a.pe.orden - b.pe.orden);

  const delay = turnoDelayMs ?? partida.turnoDelayMs ?? 3000;
  const now = new Date();

  // Mark game as started
  await db
    .update(partidas)
    .set({
      estado: 'en_curso',
      startedAt: now,
      turnoActual: 0,
      modoEjecucion: modo,
      turnoDelayMs: delay,
      ...(modo === 'auto' ? { autoRunActivoDesde: now } : {}),
    })
    .where(eq(partidas.id, id));

  // Create first turn for the first team
  if (gameTeams.length > 0) {
    await db.insert(turnos).values({
      id: uuidv4(),
      partidaId: id,
      equipoId: gameTeams[0].pe.equipoId,
      numero: 1,
      estado: 'en_curso',
      startedAt: now,
    });
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
    nombre: partida.nombre,
    ts: Date.now(),
  });

  // Si es modo auto, delegar al GameRunner (proceso servidor, fuera del ciclo HTTP)
  if (modo === 'auto') {
    gameRunner.start(id, delay);
  }

  return NextResponse.json({
    id,
    estado: 'en_curso',
    modoEjecucion: modo,
    iniciadaAt: now.toISOString(),
  });
}
