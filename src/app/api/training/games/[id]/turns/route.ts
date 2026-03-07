/**
 * GET /api/training/games/[id]/turns — Turn history for a training game
 *
 * Admins see: accion, durationMs, numero, esBot (no debug data)
 * Owner equipo sees: all fields including gameStateView, agentTrace, memoria*
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || (session.user.rol !== 'equipo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const game = await db
    .select()
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.id, id))
    .get();

  if (!game) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  if (session.user.rol === 'equipo' && session.user.equipo?.id !== game.equipoId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const isOwner = session.user.rol === 'equipo' && session.user.equipo?.id === game.equipoId;

  const turns = await db
    .select()
    .from(turnosEntrenamiento)
    .where(eq(turnosEntrenamiento.partidaId, id))
    .orderBy(asc(turnosEntrenamiento.numero))
    .all();

  const result = turns.map((t) => {
    const base = {
      id: t.id,
      partidaId: t.partidaId,
      equipoId: t.equipoId,
      esBot: t.esBot,
      numero: t.numero,
      accion: t.accion ? JSON.parse(t.accion) : null,
      refutacion: t.refutacionJson ? JSON.parse(t.refutacionJson) : null,
      durationMs: t.durationMs,
      createdAt: t.createdAt?.toISOString() ?? '',
    };

    if (!isOwner) return base;

    return {
      ...base,
      gameStateView: t.gameStateView ? JSON.parse(t.gameStateView) : null,
      agentTrace: t.agentTrace ? JSON.parse(t.agentTrace) : null,
      memoriaInicial: t.memoriaInicial ? JSON.parse(t.memoriaInicial) : null,
      memoriaFinal: t.memoriaFinal ? JSON.parse(t.memoriaFinal) : null,
    };
  });

  return NextResponse.json({ turns: result });
}
