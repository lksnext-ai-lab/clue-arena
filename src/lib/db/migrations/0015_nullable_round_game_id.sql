-- Make tournament_round_games.game_id nullable so bye entries can use NULL
-- instead of the invalid placeholder 'bye' that broke the FK constraint.
-- SQLite does not support ALTER COLUMN, so the table must be recreated.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_tournament_round_games` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`game_id` text,
	`is_bye` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `tournament_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `partidas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tournament_round_games` SELECT `id`, `round_id`, `game_id`, `is_bye` FROM `tournament_round_games`;
--> statement-breakpoint
DROP TABLE `tournament_round_games`;
--> statement-breakpoint
ALTER TABLE `__new_tournament_round_games` RENAME TO `tournament_round_games`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
