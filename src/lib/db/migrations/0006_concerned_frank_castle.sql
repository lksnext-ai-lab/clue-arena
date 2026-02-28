CREATE TABLE `score_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`turno` integer NOT NULL,
	`type` text NOT NULL,
	`points` integer NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
