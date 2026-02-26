import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas, turnos } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/games/:id/stop
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

  if (partida.estado !== 'en_curso') {
    return NextResponse.json({ error: 'La partida no está en curso' }, { status: 409 });
  }

  // Mark all in-progress turns as completed
  const activeTurns = await db
    .select()
    .from(turnos)
    .where(and(eq(turnos.partidaId, id), eq(turnos.estado, 'en_curso')))
    .all();

  for (const turn of activeTurns) {
    await db
      .update(turnos)
      .set({ estado: 'completado', finishedAt: new Date() })
      .where(eq(turnos.id, turn.id));
  }

  // Mark game as finished
  await db
    .update(partidas)
    .set({ estado: 'finalizada', finishedAt: new Date() })
    .where(eq(partidas.id, id));

  return NextResponse.json({ success: true, estado: 'finalizada' });
}
