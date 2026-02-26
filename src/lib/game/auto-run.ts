/**
 * Auto-run loop for Clue Arena (F007 — §5.3).
 *
 * `startAutoRun` is a **fire-and-forget** function:
 * the Route Handler calls it without `await` and immediately returns 202.
 *
 * The loop:
 *  1. Reads `partidas.modoEjecucion` before EVERY turn.
 *  2. Stops if the game is 'finalizada' or `modoEjecucion` ≠ 'auto'.
 *  3. Delegates each turn to `advanceTurn` (coordinator).
 *  4. Clears `autoRunActivoDesde` when the loop ends.
 *
 * Guarantees:
 *  - A turn in progress is NEVER interrupted; the pause check runs between turns.
 *  - Only one loop per game at a time (callers must verify `autoRunActivoDesde`).
 */

import { db } from '@/lib/db';
import { partidas } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { advanceTurn } from './coordinator';

// Re-export so routes can import advanceTurn from the same module as startAutoRun.
export { advanceTurn } from './coordinator';
export type { AdvanceTurnResult, CoordinatorError } from './coordinator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run turns in a loop until the game is `finalizada` or `modoEjecucion` ≠ 'auto'.
 *
 * @param gameId  The ID of the game to run.
 * @param delayMs Milliseconds to wait between turns (default 3000).
 */
export async function startAutoRun(gameId: string, delayMs = 3000): Promise<void> {
  try {
    while (true) {
      // ── 1. Check game state before each turn ──────────────────────────────
      const partida = await db
        .select({
          estado: partidas.estado,
          modoEjecucion: partidas.modoEjecucion,
        })
        .from(partidas)
        .where(eq(partidas.id, gameId))
        .get();

      if (!partida) break; // Game deleted
      if (partida.modoEjecucion !== 'auto') break; // Pause or manual change
      if (partida.estado === 'finalizada') break; // Game already finished

      // ── 2. Execute one turn ───────────────────────────────────────────────
      const result = await advanceTurn(gameId);

      if (result.gameOver) break;

      // ── 3. Wait between turns ─────────────────────────────────────────────
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  } catch {
    // Errors during auto-run are swallowed (fire-and-forget).
    // The game state in the DB remains consistent because each advanceTurn
    // is transactionally safe. An admin can resume or inspect from the UI.
  } finally {
    // Clear the active sentinel regardless of how the loop ended
    await db
      .update(partidas)
      .set({ autoRunActivoDesde: null })
      .where(eq(partidas.id, gameId))
      .catch(() => {
        // Best-effort; don't throw from finally
      });
  }
}
