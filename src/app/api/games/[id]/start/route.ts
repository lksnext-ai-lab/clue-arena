import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas, partidaEquipos, equipos, turnos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// POST /api/games/:id/start
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
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

  // Mark game as started
  await db
    .update(partidas)
    .set({ estado: 'en_curso', startedAt: new Date(), turnoActual: 0 })
    .where(eq(partidas.id, id));

  // Create first turn for the first team
  if (gameTeams.length > 0) {
    await db.insert(turnos).values({
      id: uuidv4(),
      partidaId: id,
      equipoId: gameTeams[0].pe.equipoId,
      numero: 1,
      estado: 'en_curso',
      startedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true, estado: 'en_curso' });
}
