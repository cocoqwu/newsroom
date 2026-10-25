CREATE TABLE `event_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`mime` text,
	`size_bytes` integer,
	`transcript` text,
	`status` text DEFAULT 'ready' NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`date` text,
	`description` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`speaker_id` integer,
	`speaker_name` text,
	`timestamp` text,
	`type` text NOT NULL,
	`quote` text NOT NULL,
	`paraphrase` text NOT NULL,
	`tags` text,
	`status` text DEFAULT 'new' NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `speakers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`permission` text DEFAULT 'paraphrase' NOT NULL
);
