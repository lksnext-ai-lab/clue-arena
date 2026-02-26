CREATE TABLE `agent_memories` (
	`game_id` text NOT NULL,
	`team_id` text NOT NULL,
	`memory_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`game_id`, `team_id`)
);
