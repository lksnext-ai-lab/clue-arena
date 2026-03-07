// src/lib/ws/NotificationEmitter.ts
// NOTE: Solo puede importarse en código Node.js (server.ts, Route Handlers, training-loop.ts).
// NO importar en Edge runtime ni Client Components.
import { EventEmitter } from 'events';

// ── Tipos de eventos globales (partidas oficiales) ────────────────────────────
export type GlobalNotificationEvent =
  | { type: 'notification:game_scheduled'; gameId: string; nombre: string; ts: number }
  | { type: 'notification:game_started';   gameId: string; nombre: string; ts: number }
  | { type: 'notification:game_finished';  gameId: string; nombre: string; ganadorId: string | null; ganadorNombre: string | null; ts: number }
  | { type: 'notification:ranking_updated'; ts: number }
  // G005: Tournament events
  | { type: 'tournament:round_started';   tournamentId: string; roundId: string; roundNumber: number; phase: string; ts: number }
  | { type: 'tournament:round_finished';  tournamentId: string; roundId: string; standings: unknown[]; ts: number }
  | { type: 'tournament:team_eliminated'; tournamentId: string; teamId: string; roundId: string; ts: number }
  | { type: 'tournament:finished';        tournamentId: string; winnerId: string | null; finalStandings: unknown[]; ts: number };

// ── Tipos de eventos de equipo (partidas de entrenamiento) ────────────────────
export type TeamNotificationEvent =
  | { type: 'notification:training_started';  trainingGameId: string; equipoId: string; numBots: number; ts: number }
  | { type: 'notification:training_finished'; trainingGameId: string; equipoId: string; estado: 'finalizada' | 'abortada'; ganadorId: string | null; numTurnos: number; puntosSimulados: number; motivoAbort?: string; ts: number }
  | { type: 'notification:training_error';    trainingGameId: string; equipoId: string; message: string; ts: number };

const GLOBAL_CHANNEL = 'notifications:global';
const teamChannel = (equipoId: string) => `notifications:team:${equipoId}`;

class NotificationEmitter extends EventEmitter {
  // ── Global ───────────────────────────────────────────────────────────────
  emitGlobal(event: GlobalNotificationEvent) {
    this.emit(GLOBAL_CHANNEL, event);
  }

  onGlobal(listener: (event: GlobalNotificationEvent) => void): () => void {
    this.on(GLOBAL_CHANNEL, listener);
    return () => this.off(GLOBAL_CHANNEL, listener);
  }

  // ── Team ─────────────────────────────────────────────────────────────────
  emitTeam(event: TeamNotificationEvent) {
    this.emit(teamChannel(event.equipoId), event);
  }

  onTeam(equipoId: string, listener: (event: TeamNotificationEvent) => void): () => void {
    this.on(teamChannel(equipoId), listener);
    return () => this.off(teamChannel(equipoId), listener);
  }
}

// ─── Singleton compartido entre el custom server y los Route Handlers ────────
//
// Igual que GameEventEmitter: guardamos la instancia en globalThis para que
// todos los bundles webpack del mismo proceso compartan la misma instancia.
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_KEY = Symbol.for('clue-arena.notificationEmitter');

type GlobalWithEmitter = typeof globalThis & {
  [key: symbol]: NotificationEmitter;
};

if (!(globalThis as GlobalWithEmitter)[GLOBAL_KEY]) {
  const emitter = new NotificationEmitter();
  emitter.setMaxListeners(300);
  (globalThis as GlobalWithEmitter)[GLOBAL_KEY] = emitter;
}

export const notificationEmitter: NotificationEmitter =
  (globalThis as GlobalWithEmitter)[GLOBAL_KEY];
