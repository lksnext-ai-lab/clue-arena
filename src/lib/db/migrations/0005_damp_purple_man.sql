CREATE TABLE `pases` (
	`id` text PRIMARY KEY NOT NULL,
	`turno_id` text NOT NULL,
	`partida_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`origen` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partida_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
