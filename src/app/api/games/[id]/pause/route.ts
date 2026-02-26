/**
 * POST /api/games/{id}/pause
 *
 * Pauses the auto-run loop.
 * Sets `modoEjecucion = 'pausado'`.
 *
 * The turn currently in progress (if any) completes normally; the loop
 * checks `modoEjecucion` before starting the NEXT turn, so the pause
 * takes effect at the turn boundary.
 *
 * Returns 200 with the updated mode.
 * Auth: admin only.
 */

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const partida = await db
    .select()
    .from(partidas)
    .where(eq(partidas.id, id))
    .get();

  if (!partida) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }
  if (partida.estado !== 'en_curso') {
    return NextResponse.json(
      { error: 'La partida no está en curso' },
      { status: 400 },
    );
  }
  if (partida.modoEjecucion !== 'auto') {
    return NextResponse.json(
      { error: `La partida no está en modo auto (modo actual: ${partida.modoEjecucion})` },
      { status: 400 },
    );
  }

  await db
    .update(partidas)
    .set({ modoEjecucion: 'pausado' })
    .where(eq(partidas.id, id));

  return NextResponse.json({ success: true, modoEjecucion: 'pausado' });
}
