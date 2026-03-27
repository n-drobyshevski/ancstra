CREATE TABLE `ancestor_paths` (
	`ancestor_id` text NOT NULL,
	`descendant_id` text NOT NULL,
	`depth` integer NOT NULL,
	PRIMARY KEY(`ancestor_id`, `descendant_id`),
	FOREIGN KEY (`ancestor_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`descendant_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ap_descendant` ON `ancestor_paths` (`descendant_id`,`depth`);--> statement-breakpoint
CREATE INDEX `idx_ap_ancestor` ON `ancestor_paths` (`ancestor_id`,`depth`);--> statement-breakpoint
CREATE TABLE `biographies` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`tone` text NOT NULL,
	`length` text NOT NULL,
	`focus` text NOT NULL,
	`content` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_usd` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_biographies_person` ON `biographies` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bio_person_opts` ON `biographies` (`person_id`,`tone`,`length`,`focus`);--> statement-breakpoint
CREATE TABLE `family_user_cache` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `historical_context` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`events` text NOT NULL,
	`model` text NOT NULL,
	`cost_usd` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_hist_ctx_person` ON `historical_context` (`person_id`);--> statement-breakpoint
CREATE TABLE `pending_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`operation` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_id` text,
	`review_comment` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pending_status` ON `pending_contributions` (`status`);--> statement-breakpoint
CREATE TABLE `person_summary` (
	`person_id` text PRIMARY KEY NOT NULL,
	`given_name` text DEFAULT '' NOT NULL,
	`surname` text DEFAULT '' NOT NULL,
	`sex` text NOT NULL,
	`is_living` integer NOT NULL,
	`birth_date` text,
	`death_date` text,
	`birth_date_sort` integer,
	`death_date_sort` integer,
	`birth_place` text,
	`death_place` text,
	`spouse_count` integer DEFAULT 0 NOT NULL,
	`child_count` integer DEFAULT 0 NOT NULL,
	`parent_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scrape_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`url` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`full_text` text,
	`title` text,
	`snippet` text,
	`error` text,
	`method` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`item_id`) REFERENCES `research_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_scrape_jobs_item` ON `scrape_jobs` (`item_id`);--> statement-breakpoint
CREATE INDEX `idx_scrape_jobs_status` ON `scrape_jobs` (`status`);
