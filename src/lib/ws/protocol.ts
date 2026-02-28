// src/lib/ws/protocol.ts
import { z } from 'zod';

/** Mensajes server → client */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  // Estado completo de la partida (enviado al suscribirse o al reconectar)
  z.object({
    type: z.literal('game:state'),
    gameId: z.string(),
    payload: z.unknown(), // GameDetailResponse serializado
    ts: z.number(),
  }),
  // Delta: turno completado
  z.object({
    type: z.literal('game:turn_completed'),
    gameId: z.string(),
    turnoNumero: z.number(),
    equipoId: z.string(),
    resultadoTipo: z.enum(['sugerencia', 'acusacion_correcta', 'acusacion_incorrecta', 'pase']),
    nextEquipoId: z.string().nullable().optional(),
    ts: z.number(),
  }),
  // Cambio de estado de la partida
  z.object({
    type: z.literal('game:status_changed'),
    gameId: z.string(),
    nuevoEstado: z.enum(['pendiente', 'en_curso', 'pausada', 'finalizada']),
    ts: z.number(),
  }),
  // Heartbeat para mantener la conexión
  z.object({ type: z.literal('ping'), ts: z.number() }),
  // Confirmación de suscripción
  z.object({ type: z.literal('subscribed'), gameId: z.string() }),
  // Error
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

/** Mensajes client → server */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  // El cliente se suscribe a una partida
  z.object({ type: z.literal('subscribe'), gameId: z.string() }),
  // El cliente responde al heartbeat
  z.object({ type: z.literal('pong') }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Evento interno que fluye por GameEventEmitter
export interface GameStateEvent {
  type: 'turn_completed' | 'status_changed' | 'state_snapshot' | 'score_event';
  gameId: string;
  payload: unknown;
}
