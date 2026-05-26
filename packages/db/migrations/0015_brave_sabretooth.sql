CREATE TABLE `search_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`thread_id` text,
	`research_item_id` text,
	`provider_kind` text NOT NULL,
	`provider_label` text,
	`query` text,
	`searched_at` integer NOT NULL,
	`outcome` text NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `research_threads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`research_item_id`) REFERENCES `research_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `search_attempts_person_idx` ON `search_attempts` (`person_id`,`searched_at`);--> statement-breakpoint
CREATE INDEX `search_attempts_thread_idx` ON `search_attempts` (`thread_id`);--> statement-breakpoint
CREATE INDEX `search_attempts_research_item_idx` ON `search_attempts` (`research_item_id`);