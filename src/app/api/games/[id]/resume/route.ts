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
import { partidas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { startAutoRun } from '@/lib/game/auto-run';

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
  if (partida.modoEjecucion !== 'pausado') {
    return NextResponse.json(
      { error: `La partida no está pausada (modo actual: ${partida.modoEjecucion})` },
      { status: 400 },
    );
  }
  if (partida.autoRunActivoDesde !== null) {
    return NextResponse.json(
      { error: 'Ya existe un bucle de auto-run activo para esta partida' },
      { status: 409 },
    );
  }

  const delay = turnoDelayMs ?? partida.turnoDelayMs;

  await db
    .update(partidas)
    .set({
      modoEjecucion: 'auto',
      turnoDelayMs: delay,
      autoRunActivoDesde: new Date(),
    })
    .where(eq(partidas.id, id));

  // Fire-and-forget: do NOT await
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  startAutoRun(id, delay);

  return NextResponse.json(
    { success: true, modoEjecucion: 'auto', turnoDelayMs: delay },
    { status: 202 },
  );
}
