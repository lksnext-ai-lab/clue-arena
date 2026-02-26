CREATE TABLE `acusaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`turno_id` text NOT NULL,
	`partida_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`sospechoso` text NOT NULL,
	`arma` text NOT NULL,
	`habitacion` text NOT NULL,
	`correcta` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partida_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `equipos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`agent_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`estado` text DEFAULT 'registrado' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipos_nombre_unique` ON `equipos` (`nombre`);--> statement-breakpoint
CREATE TABLE `partida_equipos` (
	`id` text PRIMARY KEY NOT NULL,
	`partida_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`orden` integer NOT NULL,
	`eliminado` integer DEFAULT false NOT NULL,
	`puntos` real DEFAULT 0 NOT NULL,
	`cartas` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`partida_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `partidas` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`turno_actual` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `ranking` (
	`id` text PRIMARY KEY NOT NULL,
	`equipo_id` text NOT NULL,
	`puntos` real DEFAULT 0 NOT NULL,
	`posicion` integer NOT NULL,
	`partidas_jugadas` integer DEFAULT 0 NOT NULL,
	`aciertos` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sobres` (
	`id` text PRIMARY KEY NOT NULL,
	`partida_id` text NOT NULL,
	`sospechoso` text NOT NULL,
	`arma` text NOT NULL,
	`habitacion` text NOT NULL,
	FOREIGN KEY (`partida_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sobres_partida_id_unique` ON `sobres` (`partida_id`);--> statement-breakpoint
CREATE TABLE `sugerencias` (
	`id` text PRIMARY KEY NOT NULL,
	`turno_id` text NOT NULL,
	`partida_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`sospechoso` text NOT NULL,
	`arma` text NOT NULL,
	`habitacion` text NOT NULL,
	`refutada_por` text,
	`carta_mostrada` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`turno_id`) REFERENCES `turnos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partida_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`refutada_por`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turnos` (
	`id` text PRIMARY KEY NOT NULL,
	`partida_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`numero` integer NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`partida_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nombre` text NOT NULL,
	`rol` text DEFAULT 'equipo' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);