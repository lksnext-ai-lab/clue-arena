CREATE TABLE `warning_eliminaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`equipo_eliminado_id` text NOT NULL,
	`turno` integer NOT NULL,
	`cartas_count` integer NOT NULL,
	`redistribucion_json` text NOT NULL,
	`creado_en` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `partida_equipos` ADD `eliminacion_razon` text;--> statement-breakpoint
ALTER TABLE `partida_equipos` ADD `warnings` integer DEFAULT 0 NOT NULL;