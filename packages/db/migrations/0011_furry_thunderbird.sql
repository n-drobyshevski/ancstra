DROP TABLE `proposed_relationships`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_research_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`snippet` text,
	`full_text` text,
	`notes` text,
	`archived_html_path` text,
	`screenshot_path` text,
	`archived_at` text,
	`provider_id` text,
	`provider_record_id` text,
	`discovery_method` text NOT NULL,
	`search_query` text,
	`status` text DEFAULT 'collected' NOT NULL,
	`promoted_source_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `search_providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promoted_source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_research_items`("id", "title", "url", "snippet", "full_text", "notes", "archived_html_path", "screenshot_path", "archived_at", "provider_id", "provider_record_id", "discovery_method", "search_query", "status", "promoted_source_id", "created_by", "created_at", "updated_at") SELECT "id", "title", "url", "snippet", "full_text", "notes", "archived_html_path", "screenshot_path", "archived_at", "provider_id", "provider_record_id", "discovery_method", "search_query", "status", "promoted_source_id", "created_by", "created_at", "updated_at" FROM `research_items`;--> statement-breakpoint
DROP TABLE `research_items`;--> statement-breakpoint
ALTER TABLE `__new_research_items` RENAME TO `research_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_research_items_status` ON `research_items` (`status`);--> statement-breakpoint
CREATE INDEX `idx_research_items_provider` ON `research_items` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_research_items_created_by` ON `research_items` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_research_items_created_at` ON `research_items` (`created_at`);--> statement-breakpoint
ALTER TABLE `factsheet_links` ADD `contested` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `research_facts` ADD `contested` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `research_facts` ADD `provenance` text DEFAULT 'derived' NOT NULL;