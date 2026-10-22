CREATE TABLE `claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`section` text,
	`text` text NOT NULL,
	`kind` text,
	`source_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`correction` text,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `draft_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`version` integer NOT NULL,
	`body_md` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` integer NOT NULL,
	`status` text DEFAULT 'outline' NOT NULL,
	`format` text NOT NULL,
	`angle_note` text,
	`title` text,
	`thesis` text,
	`outline` text,
	`body_md` text,
	`current_version` integer DEFAULT 0 NOT NULL,
	`selected_image_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `editor_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` integer,
	`draft_id` integer,
	`action` text NOT NULL,
	`format` text,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`svg` text,
	`data_url` text,
	`status` text DEFAULT 'ready' NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`source_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_type` text NOT NULL,
	`source_group` text NOT NULL,
	`source_quality` real NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`summary` text,
	`author` text,
	`published_at` text,
	`fetched_at` text NOT NULL,
	`signals` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_url_unique` ON `items` (`url`);--> statement-breakpoint
CREATE TABLE `llm_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer,
	`draft_id` integer,
	`role` text NOT NULL,
	`task` text NOT NULL,
	`model` text NOT NULL,
	`provider` text NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`ok` integer DEFAULT true NOT NULL,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `past_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`category` text,
	`published_at` text,
	`summary` text,
	`embedding` text,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `past_posts_url_unique` ON `past_posts` (`url`);--> statement-breakpoint
CREATE TABLE `research_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draft_id` integer NOT NULL,
	`section` text NOT NULL,
	`claim` text NOT NULL,
	`source_url` text NOT NULL,
	`excerpt` text
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`mode` text DEFAULT 'live' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`items_collected` integer DEFAULT 0 NOT NULL,
	`stories_count` integer DEFAULT 0 NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`rank` integer,
	`is_wildcard` integer DEFAULT false NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`why_now` text,
	`theme` text,
	`format` text,
	`primary_item_id` integer,
	`source_count` integer DEFAULT 1 NOT NULL,
	`score_total` real,
	`signals` text,
	`covered_before` text,
	`embedding` text,
	`status` text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story_items` (
	`story_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	PRIMARY KEY(`story_id`, `item_id`)
);
