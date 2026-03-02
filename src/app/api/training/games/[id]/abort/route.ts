/**
 * POST /api/training/games/[id]/abort — Abort an in-progress training game
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'equipo') {
    return NextResponse.json({ error: 'Solo los equipos pueden abortar partidas de entrenamiento' }, { status: 403 });
  }

  const equipoId = session.user.equipo?.id;
  if (!equipoId) {
    return NextResponse.json({ error: 'Equipo no configurado' }, { status: 400 });
  }

  const row = await db
    .select()
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  if (row.equipoId !== equipoId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  if (row.estado !== 'en_curso') {
    return NextResponse.json({ error: 'La partida no está en curso' }, { status: 409 });
  }

  await db
    .update(partidasEntrenamiento)
    .set({ estado: 'abortada', motivoAbort: 'ABORTADA_POR_EQUIPO', finishedAt: new Date() })
    .where(eq(partidasEntrenamiento.id, id));

  return NextResponse.json({ success: true });
}
