CREATE TABLE `tournament_round_games` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`game_id` text NOT NULL,
	`is_bye` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `tournament_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournament_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`phase` text DEFAULT 'round' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`generated_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournament_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`team_id` text NOT NULL,
	`seed` integer,
	`group_index` integer,
	`eliminated` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `equipos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_teams_tournament_id_team_id_unique` ON `tournament_teams` (`tournament_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer
);
