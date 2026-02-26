import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
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
  agentId: text('agent_id').notNull(),
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
  estado: text('estado', { enum: ['pendiente', 'en_curso', 'completado'] })
    .notNull()
    .default('pendiente'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
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
}));

export const sugerenciasRelations = relations(sugerencias, ({ one }) => ({
  turno: one(turnos, { fields: [sugerencias.turnoId], references: [turnos.id] }),
  partida: one(partidas, { fields: [sugerencias.partidaId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [sugerencias.equipoId], references: [equipos.id] }),
}));

export const acusacionesRelations = relations(acusaciones, ({ one }) => ({
  turno: one(turnos, { fields: [acusaciones.turnoId], references: [turnos.id] }),
  partida: one(partidas, { fields: [acusaciones.partidaId], references: [partidas.id] }),
  equipo: one(equipos, { fields: [acusaciones.equipoId], references: [equipos.id] }),
}));
