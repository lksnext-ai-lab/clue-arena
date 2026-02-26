ALTER TABLE `partidas` ADD `modo_ejecucion` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `partidas` ADD `turno_delay_ms` integer DEFAULT 3000 NOT NULL;--> statement-breakpoint
ALTER TABLE `partidas` ADD `auto_run_activo_desde` integer;