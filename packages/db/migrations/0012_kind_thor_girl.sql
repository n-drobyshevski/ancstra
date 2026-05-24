PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_research_thread_events` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text,
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
INSERT INTO `__new_research_thread_events`("id", "thread_id", "event_type", "actor_id", "factsheet_id", "person_id", "research_item_id", "research_fact_id", "source_id", "link_id", "reason", "payload_json", "occurred_at") SELECT "id", "thread_id", "event_type", "actor_id", "factsheet_id", "person_id", "research_item_id", "research_fact_id", "source_id", "link_id", "reason", "payload_json", "occurred_at" FROM `research_thread_events`;--> statement-breakpoint
DROP TABLE `research_thread_events`;--> statement-breakpoint
ALTER TABLE `__new_research_thread_events` RENAME TO `research_thread_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_thread_events_thread` ON `research_thread_events` (`thread_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_events_factsheet` ON `research_thread_events` (`factsheet_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_events_person` ON `research_thread_events` (`person_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `contested` integer DEFAULT false NOT NULL;