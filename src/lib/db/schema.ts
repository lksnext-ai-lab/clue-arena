import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// --- usuarios ---
export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  nombre: text('nombre').notNull(),
  rol: text('rol', { enum: ['admin', 'equipo', 'espectador'] })
    .notNull()
    .default('equipo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- equipos ---
export const equipos = sqliteTable('equipos', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  descripcion: text('descripcion'),
  agentId: text('agent_id').notNull(),
  avatarUrl: text('avatar_url'),
  miembros: text('miembros').notNull().default('[]'), // JSON array of member emails
  usuarioId: text('usuario_id')
    .references(() => usuarios.id)
    .notNull(),
  estado: text('estado', { enum: ['registrado', 'activo', 'finalizado'] })
    .notNull()
    .default('registrado'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- partidas ---
export const partidas = sqliteTable('partidas', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  estado: text('estado', { enum: ['pendiente', 'en_curso', 'finalizada'] })
    .notNull()
    .default('pendiente'),
  turnoActual: integer('turno_actual').notNull().default(0),
  maxTurnos: integer('max_turnos'),
  // Execution mode for auto-run (F007)
  modoEjecucion: text('modo_ejecucion', { enum: ['manual', 'auto', 'pausado'] })
    .notNull()
    .default('manual'),
  turnoDelayMs: integer('turno_delay_ms').notNull().default(3000),
  autoRunActivoDesde: integer('auto_run_activo_desde', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
});

// --- partida_equipos ---
export const partidaEquipos = sqliteTable('partida_equipos', {
  id: text('id').primaryKey(),
  partidaId: text('partida_id')
    .references(() => partidas.id)
    .notNull(),
  equipoId: text('equipo_id')
    .references(() => equipos.id)
    .notNull(),
  orden: integer('orden').notNull(),
  eliminado: integer('eliminado', { mode: 'boolean' }).notNull().default(false),
  puntos: real('puntos').notNull().default(0),
  cartas: text('cartas').notNull().default('[]'), // JSON array
});

// --- sobres (sobre secreto de la partida) ---
export const sobres = sqliteTable('sobres', {
  id: text('id').primaryKey(),
  partidaId: text('partida_id')
    .references(() => partidas.id)
    .notNull()
    .unique(),
  sospechoso: text('sospechoso').notNull(),
  arma: text('arma').notNull(),
  habitacion: text('habitacion').notNull(),
});

// --- turnos ---
export const turnos = sqliteTable('turnos', {
  id: text('id').primaryKey(),
  partidaId: text('partida_id')
    .references(() => partidas.id)
    .notNull(),
  equipoId: text('equipo_id')
    .references(() => equipos.id)
    .notNull(),
  numero: integer('numero').notNull(),
  estado: text('estado', { enum: ['pendiente', 'en_curso', 'completado', 'interrumpido'] })
    .notNull()
    .default('pendiente'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  // F016: ms que tardó el agente activo en responder su acción de turno
  agentDurationMs: integer('agent_duration_ms'),
  // F016: ms que tardó el primer refutador exitoso en responder (null si no hubo refutación)
  refutacionDurationMs: integer('refutacion_duration_ms'),
});

// --- sugerencias ---
export const sugerencias = sqliteTable('sugerencias', {
  id: text('id').primaryKey(),
  turnoId: text('turno_id')
    .references(() => turnos.id)
    .notNull(),
  partidaId: text('partida_id')
    .references(() => partidas.id)
    .notNull(),
  equipoId: text('equipo_id')
    .references(() => equipos.id)
    .notNull(),
  sospechoso: text('sospechoso').notNull(),
  arma: text('arma').notNull(),
  habitacion: text('habitacion').notNull(),
  refutadaPor: text('refutada_por').references(() => equipos.id),
  cartaMostrada: text('carta_mostrada'), // Null hasta que sea revelada
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- acusaciones ---
export const acusaciones = sqliteTable('acusaciones', {
  id: text('id').primaryKey(),
  turnoId: text('turno_id')
    .references(() => turnos.id)
    .notNull(),
  partidaId: text('partida_id')
    .references(() => partidas.id)
    .notNull(),
  equipoId: text('equipo_id')
    .references(() => equipos.id)
    .notNull(),
  sospechoso: text('sospechoso').notNull(),
  arma: text('arma').notNull(),
  habitacion: text('habitacion').notNull(),
  correcta: integer('correcta', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- pases ---
export const pases = sqliteTable('pases', {
  id: text('id').primaryKey(),
  turnoId: text('turno_id')
    .references(() => turnos.id)
    .notNull(),
  partidaId: text('partida_id')
    .references(() => partidas.id)
    .notNull(),
  equipoId: text('equipo_id')
    .references(() => equipos.id)
    .notNull(),
  origen: text('origen', { enum: ['voluntario', 'timeout', 'invalid_format'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- ranking (snapshot post-evento o por partida) ---
export const ranking = sqliteTable('ranking', {
  id: text('id').primaryKey(),
  equipoId: text('equipo_id')
    .references(() => equipos.id)
    .notNull(),
  puntos: real('puntos').notNull().default(0),
  posicion: integer('posicion').notNull(),
  partidasJugadas: integer('partidas_jugadas').notNull().default(0),
  aciertos: integer('aciertos').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// --- score_events ---
export const scoreEvents = sqliteTable('score_events', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  gameId:    text('game_id').notNull().references(() => partidas.id),
  equipoId:  text('equipo_id').notNull().references(() => equipos.id),
  turno:     integer('turno').notNull(),
  type:      text('type').notNull(),        // ScoreEventType
  points:    integer('points').notNull(),
  meta:      text('meta'),                  // JSON serializado
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- Relations ---
export const usuariosRelations = relations(usuarios, ({ many }) => ({
  equipos: many(equipos),
}));

export const equiposRelations = relations(equipos, ({ one, many }) => ({
  usuario: one(usuarios, { fields: [equipos.usuarioId], references: [usuarios.id] }),
  partidaEquipos: many(partidaEquipos),
  rankingEntry: many(ranking),
}));

export const partidasRelations = relations(partidas, ({ one, many }) => ({
  sobre: one(sobres, { fields: [partidas.id], references: [sobres.partidaId] }),
  equipos: many(partidaEquipos),
  turnos: many(turnos),
}));

export const partidaEquiposRelations = relations(partidaEquipos, ({ one }) => ({
  partida: one(partidas, { fields: [partidaEquipos.partidaId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [partidaEquipos.equipoId], references: [equipos.id] }),
}));

export const turnosRelations = relations(turnos, ({ one, many }) => ({
  partida: one(partidas, { fields: [turnos.partidaId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [turnos.equipoId], references: [equipos.id] }),
  sugerencias: many(sugerencias),
  acusaciones: many(acusaciones),
  pases: many(pases),
}));

export const sugerenciasRelations = relations(sugerencias, ({ one }) => ({
  turno: one(turnos, { fields: [sugerencias.turnoId], references: [turnos.id] }),
  partida: one(partidas, { fields: [sugerencias.partidaId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [sugerencias.equipoId], references: [equipos.id] }),
}));

// --- agent_memories (local Genkit agent persistent deduction state) ---
export const agentMemories = sqliteTable(
  'agent_memories',
  {
    gameId: text('game_id').notNull(),
    teamId: text('team_id').notNull(),
    memoryJson: text('memory_json').notNull().default('{}'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.teamId] }),
  })
);

export const scoreEventsRelations = relations(scoreEvents, ({ one }) => ({
  partida: one(partidas, { fields: [scoreEvents.gameId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [scoreEvents.equipoId], references: [equipos.id] }),
}));

// --- partidas_entrenamiento (F015) ---
export const partidasEntrenamiento = sqliteTable('partidas_entrenamiento', {
  id:         text('id').primaryKey(),                      // UUID v4
  equipoId:   text('equipo_id')
                .notNull()
                .references(() => equipos.id),              // Owner of the session
  estado:     text('estado', {
                enum: ['en_curso', 'finalizada', 'abortada'],
              }).notNull().default('en_curso'),
  numBots:    integer('num_bots').notNull().default(2),     // 1–5 bot opponents
  seed:       text('seed'),                                 // Reproducible seed (optional)
  sobresJson: text('sobres_json'),                          // JSON envelope (visible when finished)
  resultadoJson: text('resultado_json'),                    // Simulated score result JSON
  motivoAbort:  text('motivo_abort'),                       // Abort reason if abortada
  createdAt:  integer('created_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
});

// --- turnos_entrenamiento (F015) ---
export const turnosEntrenamiento = sqliteTable('turnos_entrenamiento', {
  id:             text('id').primaryKey(),
  partidaId:      text('partida_id')
                    .notNull()
                    .references(() => partidasEntrenamiento.id, { onDelete: 'cascade' }),
  equipoId:       text('equipo_id').notNull(),              // May be real team or bot ID
  esBot:          integer('es_bot', { mode: 'boolean' }).notNull().default(false),
  numero:         integer('numero').notNull(),
  accion:         text('accion_json'),                      // AgentResponse JSON
  gameStateView:  text('game_state_view_json'),             // GameStateView received by agent
  agentTrace:     text('agent_trace_json'),                 // AgentInteractionTrace JSON (real team only)
  memoriaInicial: text('memoria_inicial_json'),             // Memory state before turn
  memoriaFinal:   text('memoria_final_json'),               // Memory state after turn
  durationMs:     integer('duration_ms'),
  createdAt:      integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- Relations for F015 tables ---
export const partidasEntrenamientoRelations = relations(partidasEntrenamiento, ({ one, many }) => ({
  equipo: one(equipos, { fields: [partidasEntrenamiento.equipoId], references: [equipos.id] }),
  turnos: many(turnosEntrenamiento),
}));

export const turnosEntrenamientoRelations = relations(turnosEntrenamiento, ({ one }) => ({
  partida: one(partidasEntrenamiento, {
    fields: [turnosEntrenamiento.partidaId],
    references: [partidasEntrenamiento.id],
  }),
}));

export const acusacionesRelations = relations(acusaciones, ({ one }) => ({
  turno: one(turnos, { fields: [acusaciones.turnoId], references: [turnos.id] }),
  partida: one(partidas, { fields: [acusaciones.partidaId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [acusaciones.equipoId], references: [equipos.id] }),
}));

export const pasesRelations = relations(pases, ({ one }) => ({
  turno: one(turnos, { fields: [pases.turnoId], references: [turnos.id] }),
  partida: one(partidas, { fields: [pases.partidaId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [pases.equipoId], references: [equipos.id] }),
}));
