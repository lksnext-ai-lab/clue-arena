/**
 * GameRunner — gestiona los bucles de auto-ejecución fuera del ciclo HTTP.
 *
 * Cada partida en modo 'auto' tiene exactamente un loop Promise corriendo en
 * el event loop de Node.js. Estos loops son independientes de las peticiones
 * HTTP: los Route Handlers solo señalizan al runner a través de globalThis.
 *
 * Ciclo de vida:
 *  start(gameId) → crea AbortController → lanza startAutoRun (fire-and-forget)
 *  stop(gameId)  → llama ac.abort()     → cancela el sleep inter-turno
 *  El loop se limpia en su propio finally (ver auto-run.ts).
 *
 * Lógica del loop:
 *  Delegada a `startAutoRun` (auto-run.ts) — fuente única de verdad, testeable
 *  de forma aislada con Vitest. El AbortSignal se comprueba entre turnos y
 *  cancela el sleep inmediatamente sin interrumpir un turno en curso.
 *
 * Singleton:
 *  Almacenado en globalThis['clue-arena.gameRunner'] para que sea compartido
 *  entre el bundle del servidor (server.ts) y los bundles webpack de los
 *  Route Handlers dentro del mismo proceso Node.js.
 */

import { startAutoRun } from './auto-run';

// ---------------------------------------------------------------------------
// GameRunner class
// ---------------------------------------------------------------------------

class GameRunner {
  /** gameId → AbortController del loop activo */
  private readonly loops = new Map<string, AbortController>();

  /** ¿Hay un loop activo en este proceso para la partida? */
  isRunning(gameId: string): boolean {
    return this.loops.has(gameId);
  }

  /**
   * Lanza el loop de auto-ejecución para una partida.
   *
   * El loop corre como una Promise flotante en el event loop de Node.js —
   * no se awaita ni aquí ni en los Route Handlers.
   *
   * @returns `true` si se lanzó un loop nuevo, `false` si ya había uno activo.
   */
  start(gameId: string, delayMs = 3000): boolean {
    if (this.loops.has(gameId)) return false;

    const ac = new AbortController();
    this.loops.set(gameId, ac);

    void startAutoRun(gameId, delayMs, ac.signal).finally(() => {
      this.loops.delete(gameId);
    });

    return true;
  }

  /**
   * Señaliza el loop para que termine tras el turno en curso.
   * Cancela el sleep inter-turno inmediatamente (AbortController).
   *
   * @returns `true` si había un loop activo y se señalizó, `false` si no.
   */
  stop(gameId: string): boolean {
    const ac = this.loops.get(gameId);
    if (!ac) return false;
    ac.abort();
    return true;
  }
}

// ---------------------------------------------------------------------------
// Singleton en globalThis
// ---------------------------------------------------------------------------

const RUNNER_KEY = Symbol.for('clue-arena.gameRunner');

type GlobalWithRunner = typeof globalThis & {
  [key: symbol]: GameRunner;
};

if (!(globalThis as GlobalWithRunner)[RUNNER_KEY]) {
  (globalThis as GlobalWithRunner)[RUNNER_KEY] = new GameRunner();
}

export const gameRunner: GameRunner = (globalThis as GlobalWithRunner)[RUNNER_KEY];
