CREATE TABLE `partidas_entrenamiento` (
	`id` text PRIMARY KEY NOT NULL,
	`equipo_id` text NOT NULL,
	`estado` text DEFAULT 'en_curso' NOT NULL,
	`num_bots` integer DEFAULT 2 NOT NULL,
	`seed` text,
	`sobres_json` text,
	`resultado_json` text,
	`motivo_abort` text,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`equipo_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turnos_entrenamiento` (
	`id` text PRIMARY KEY NOT NULL,
	`partida_id` text NOT NULL,
	`equipo_id` text NOT NULL,
	`es_bot` integer DEFAULT false NOT NULL,
	`numero` integer NOT NULL,
	`accion_json` text,
	`game_state_view_json` text,
	`agent_trace_json` text,
	`memoria_inicial_json` text,
	`memoria_final_json` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`partida_id`) REFERENCES `partidas_entrenamiento`(`id`) ON UPDATE no action ON DELETE cascade
);
