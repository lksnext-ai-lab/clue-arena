/**
 * POST /api/games/{id}/advance-turn
 *
 * Advances the game by one complete turn:
 *  1. Invokes the current team's agent (play_turn).
 *  2. Applies the AgentResponse (suggestion or accusation).
 *  3. Handles refutation sub-flow if needed.
 *  4. Persists all changes and advances to the next team.
 *
 * Auth: admin only.
 * This endpoint is also the building block used by the auto-run loop
 * (`startAutoRun` in auto-run.ts calls `advanceTurn` directly).
 */

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { advanceTurn, CoordinatorError } from '@/lib/game/coordinator';

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

  // Verify game state and mode
  const partida = await db.select().from(partidas).where(eq(partidas.id, id)).get();
  if (!partida) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }
  if (partida.estado !== 'en_curso') {
    return NextResponse.json({ error: 'La partida no está en curso' }, { status: 409 });
  }
  if (partida.modoEjecucion !== 'manual' && partida.modoEjecucion !== 'pausado') {
    return NextResponse.json(
      { error: 'La partida está en modo auto. Usa /pause antes de avanzar manualmente.' },
      { status: 409 },
    );
  }

  try {
    const result = await advanceTurn(id);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    if (err instanceof CoordinatorError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[advance-turn] Unexpected error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
