CREATE TABLE `research_thread_events` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`factsheet_id` text,
	`person_id` text,
	`research_item_id` text,
	`research_fact_id` text,
	`source_id` text,
	`link_id` text,
	`reason` text,
	`payload_json` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `research_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`factsheet_id`) REFERENCES `factsheets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`research_item_id`) REFERENCES `research_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`research_fact_id`) REFERENCES `research_facts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`link_id`) REFERENCES `factsheet_links`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_thread_events_thread` ON `research_thread_events` (`thread_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_events_factsheet` ON `research_thread_events` (`factsheet_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_events_person` ON `research_thread_events` (`person_id`);--> statement-breakpoint
CREATE TABLE `research_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`seed_person_id` text,
	`seed_factsheet_id` text,
	`seed_research_item_id` text,
	`summary` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`seed_person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`seed_factsheet_id`) REFERENCES `factsheets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`seed_research_item_id`) REFERENCES `research_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_threads_status` ON `research_threads` (`status`);--> statement-breakpoint
CREATE INDEX `idx_threads_created_by` ON `research_threads` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_threads_updated_at` ON `research_threads` (`updated_at`);--> statement-breakpoint
ALTER TABLE `factsheets` ADD `created_thread_id` text;--> statement-breakpoint
CREATE INDEX `idx_factsheets_thread` ON `factsheets` (`created_thread_id`);