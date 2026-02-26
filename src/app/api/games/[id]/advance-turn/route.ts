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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const result = await advanceTurn(id);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    if (err instanceof CoordinatorError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[advance-turn] Unexpected error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
