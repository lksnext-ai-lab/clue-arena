/**
 * Auto-run loop para Clue Arena (F007 — §5.3).
 *
 * `startAutoRun` es la función awaitable que ejecuta el loop de turnos.
 * Puede usarse directamente en tests (awaitable) o a través de GameRunner
 * (runner.ts) para producción (fire-and-forget, con AbortController).
 *
 * El loop:
 *  1. Comprueba `partidas.modoEjecucion` antes de CADA turno.
 *  2. Para si la partida es 'finalizada' o `modoEjecucion` ≠ 'auto'.
 *  3. Para si el AbortSignal (del GameRunner) está abortado.
 *  4. Delega cada turno a `advanceTurn` (coordinator).
 *  5. Limpia `autoRunActivoDesde` al terminar.
 *
 * Garantías:
 *  - Un turno en curso NO se interrumpe nunca; la comprobación de pausa
 *    ocurre ENTRE turnos.
 *  - El AbortSignal cancela el sleep inter-turno inmediatamente.
 *  - Solo un loop por partida a la vez (el caller debe verificar `autoRunActivoDesde`).
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Ejecuta turnos en bucle hasta que la partida sea `finalizada`,
 * `modoEjecucion` ≠ 'auto', o el AbortSignal sea señalizado.
 *
 * @param gameId   ID de la partida.
 * @param delayMs  Milisegundos entre turnos (por defecto 3000).
 * @param signal   AbortSignal opcional del GameRunner para cancelación inmediata.
 */
export async function startAutoRun(
  gameId: string,
  delayMs = 3000,
  signal?: AbortSignal,
): Promise<void> {
  try {
    while (!signal?.aborted) {
      // ── 1. Verificar estado antes de cada turno ────────────────────────────
      const partida = await db
        .select({
          estado: partidas.estado,
          modoEjecucion: partidas.modoEjecucion,
        })
        .from(partidas)
        .where(eq(partidas.id, gameId))
        .get();

      if (!partida) break; // partida eliminada
      if (partida.modoEjecucion !== 'auto') break; // pausada o manual
      if (partida.estado === 'finalizada') break;

      // ── 2. Ejecutar un turno ───────────────────────────────────────────────
      const result = await advanceTurn(gameId);

      if (result.gameOver) break;

      // ── 3. Esperar entre turnos (cancelable con AbortSignal) ───────────────
      if (delayMs > 0) {
        try {
          await sleep(delayMs, signal);
        } catch {
          break; // AbortError → salir limpiamente
        }
      }
    }
  } catch {
    // Errores en advanceTurn son tragados (fire-and-forget).
    // El estado en BD sigue siendo consistente porque cada advanceTurn
    // es atómico. El admin puede reanudar o inspeccionar desde la UI.
  } finally {
    // Limpiar el sentinel de la BD (best-effort)
    await db
      .update(partidas)
      .set({ autoRunActivoDesde: null })
      .where(eq(partidas.id, gameId))
      .catch(() => {});
  }
}
