ALTER TABLE `partidas` ADD `turno_en_proceso_token` text;
--> statement-breakpoint
ALTER TABLE `partidas` ADD `turno_en_proceso_desde` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `turnos_partida_numero_unique` ON `turnos` (`partida_id`, `numero`);
--> statement-breakpoint
CREATE UNIQUE INDEX `turnos_partida_en_curso_unique` ON `turnos` (`partida_id`) WHERE `estado` = 'en_curso';
--> statement-breakpoint
CREATE UNIQUE INDEX `partidas_entrenamiento_equipo_activa_unique` ON `partidas_entrenamiento` (`equipo_id`) WHERE `estado` = 'en_curso';
