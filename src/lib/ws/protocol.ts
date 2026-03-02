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
  // Micro-evento: el coordinador solicita el turno al agente activo
  z.object({
    type: z.literal('turn:agent_invoked'),
    gameId: z.string(),
    turnoId: z.string(),
    turnoNumero: z.number(),
    equipoId: z.string(),
    equipoNombre: z.string(),
    ts: z.number(),
  }),
  // Micro-evento: el agente activo ha respondido
  z.object({
    type: z.literal('turn:agent_responded'),
    gameId: z.string(),
    turnoId: z.string(),
    turnoNumero: z.number(),
    equipoId: z.string(),
    equipoNombre: z.string(),
    accion: z.enum(['sugerencia', 'acusacion', 'pasar', 'timeout', 'formato_invalido']),
    // Presente cuando accion === 'sugerencia': expuesto al espectador para máximo dinamismo
    sugerencia: z.object({
      sospechoso: z.string(),
      arma: z.string(),
      habitacion: z.string(),
    }).optional(),
    durationMs: z.number(),
    ts: z.number(),
  }),
  // Micro-evento: el coordinador solicita refutación a uno o más agentes
  z.object({
    type: z.literal('turn:refutation_requested'),
    gameId: z.string(),
    turnoId: z.string(),
    turnoNumero: z.number(),
    equipoSugeridor: z.string(),
    refutadoresIds: z.array(z.string()),
    ts: z.number(),
  }),
  // Micro-evento: un agente refutador ha respondido
  // cartaMostrada: la carta usada para refutar, visible para espectadores pero NO enviada al GameStateView de otros agentes
  z.object({
    type: z.literal('turn:refutation_received'),
    gameId: z.string(),
    turnoId: z.string(),
    turnoNumero: z.number(),
    equipoId: z.string(),
    equipoNombre: z.string(),
    resultado: z.enum(['refutada', 'no_puede_refutar']),
    cartaMostrada: z.string().optional(),
    durationMs: z.number(),
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
