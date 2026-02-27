// src/lib/ws/GameEventEmitter.ts
// NOTE: Solo puede importarse en código Node.js (Route Handlers, server.ts, coordinator.ts).
// NO importar en Client Components ni Edge runtime.
import { EventEmitter } from 'events';
import type { GameStateEvent } from './protocol';

class GameEventEmitter extends EventEmitter {
  emitTurnCompleted(gameId: string, payload: GameStateEvent) {
    this.emit(`game:${gameId}`, payload);
  }

  onGameUpdate(gameId: string, listener: (event: GameStateEvent) => void) {
    this.on(`game:${gameId}`, listener);
    return () => this.off(`game:${gameId}`, listener);
  }
}

// ─── Singleton compartido entre el custom server y los Route Handlers ────────
//
// Next.js compila los Route Handlers con webpack en bundles separados del
// custom server (server.ts). Si usamos una variable de módulo normal, cada
// bundle obtiene su propia instancia y el coordinator emite en una instancia
// distinta a la que escucha el WS server → los eventos nunca llegan.
//
// Solución estándar Next.js: guardar la instancia en globalThis, que es
// compartido por todos los bundles dentro del mismo proceso Node.js.
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_KEY = Symbol.for('clue-arena.gameEventEmitter');

type GlobalWithEmitter = typeof globalThis & {
  [key: symbol]: GameEventEmitter;
};

if (!(globalThis as GlobalWithEmitter)[GLOBAL_KEY]) {
  const emitter = new GameEventEmitter();
  emitter.setMaxListeners(200); // ~200 clientes concurrentes esperados
  (globalThis as GlobalWithEmitter)[GLOBAL_KEY] = emitter;
}

const gameEventEmitter: GameEventEmitter = (globalThis as GlobalWithEmitter)[GLOBAL_KEY];

export { gameEventEmitter };
