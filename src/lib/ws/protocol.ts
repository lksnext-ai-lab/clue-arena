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
    accion: z.enum(['sugerencia', 'acusacion', 'pasar', 'timeout', 'formato_invalido', 'error_comunicacion']),
    // Presente cuando accion === 'sugerencia': expuesto al espectador para máximo dinamismo
    sugerencia: z.object({
      sospechoso: z.string(),
      arma: z.string(),
      habitacion: z.string(),
    }).optional(),
    durationMs: z.number(),
    // G004: short natural-language comment for spectators (max 500 chars for accusations, 160 otherwise)
    spectatorComment: z.string().max(500).optional(),
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
    // G004: short natural-language comment from the refutador for spectators (max 160 chars)
    spectatorComment: z.string().max(500).optional(),
    ts: z.number(),
  }),
  // G006: warning system events
  z.object({
    type: z.literal('warning:issued'),
    gameId: z.string(),
    equipoId: z.string(),
    warnings: z.number().int().min(1).max(3),
    reason: z.string(),
    ts: z.number(),
  }),
  z.object({
    type: z.literal('warning:agent_eliminated'),
    gameId: z.string(),
    equipoId: z.string(),
    equiposConCartasNuevas: z.array(z.string()),
    ts: z.number(),
  }),
  // Heartbeat para mantener la conexión
  z.object({ type: z.literal('ping'), ts: z.number() }),
  // Confirmación de suscripción de partida
  z.object({ type: z.literal('subscribed'), gameId: z.string() }),
  // Confirmación de suscripción de notificaciones
  z.object({
    type: z.literal('subscribed:notifications'),
    scope: z.union([z.literal('global'), z.object({ team: z.string() })]),
  }),
  // ── Notificaciones globales (partidas oficiales) ──────────────────────────
  z.object({ type: z.literal('notification:game_scheduled'), gameId: z.string(), nombre: z.string(), ts: z.number() }),
  z.object({ type: z.literal('notification:game_started'),   gameId: z.string(), nombre: z.string(), ts: z.number() }),
  z.object({
    type: z.literal('notification:game_finished'),
    gameId: z.string(),
    nombre: z.string(),
    ganadorId: z.string().nullable(),
    ganadorNombre: z.string().nullable(),
    ts: z.number(),
  }),
  z.object({ type: z.literal('notification:ranking_updated'), ts: z.number() }),
  // ── Notificaciones de equipo (partidas de entrenamiento) ──────────────────
  z.object({ type: z.literal('notification:training_started'),  trainingGameId: z.string(), equipoId: z.string(), numBots: z.number(), ts: z.number() }),
  z.object({
    type: z.literal('notification:training_finished'),
    trainingGameId: z.string(),
    equipoId: z.string(),
    estado: z.enum(['finalizada', 'abortada']),
    ganadorId: z.string().nullable(),
    numTurnos: z.number(),
    puntosSimulados: z.number(),
    motivoAbort: z.string().optional(),
    ts: z.number(),
  }),
  z.object({ type: z.literal('notification:training_error'), trainingGameId: z.string(), equipoId: z.string(), message: z.string(), ts: z.number() }),
  // Error
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
  // ── G005: Tournament events ────────────────────────────────────────────────
  z.object({
    type:         z.literal('tournament:round_started'),
    tournamentId: z.string(),
    roundId:      z.string(),
    roundNumber:  z.number(),
    phase:        z.string(),
    ts:           z.number(),
  }),
  z.object({
    type:         z.literal('tournament:round_finished'),
    tournamentId: z.string(),
    roundId:      z.string(),
    standings:    z.array(z.unknown()),
    ts:           z.number(),
  }),
  z.object({
    type:         z.literal('tournament:team_eliminated'),
    tournamentId: z.string(),
    teamId:       z.string(),
    roundId:      z.string(),
    ts:           z.number(),
  }),
  z.object({
    type:           z.literal('tournament:finished'),
    tournamentId:   z.string(),
    winnerId:       z.string().nullable(),
    finalStandings: z.array(z.unknown()),
    ts:             z.number(),
  }),
]);

/** Mensajes client → server */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  // El cliente se suscribe a una partida
  z.object({ type: z.literal('subscribe'), gameId: z.string() }),
  // El cliente se suscribe a notificaciones de ciclo de vida
  z.object({
    type: z.literal('subscribe:notifications'),
    scope: z.union([z.literal('global'), z.object({ team: z.string() })]),
  }),
  // El cliente cancela su suscripción a notificaciones
  z.object({ type: z.literal('unsubscribe:notifications') }),
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
