CREATE TABLE `factsheet_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_factsheet_id` text NOT NULL,
	`to_factsheet_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`source_fact_id` text,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`source_handle` text,
	`target_handle` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`from_factsheet_id`) REFERENCES `factsheets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_factsheet_id`) REFERENCES `factsheets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_factsheet_links_from` ON `factsheet_links` (`from_factsheet_id`);--> statement-breakpoint
CREATE INDEX `idx_factsheet_links_to` ON `factsheet_links` (`to_factsheet_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_factsheet_links` ON `factsheet_links` (`from_factsheet_id`,`to_factsheet_id`,`relationship_type`);--> statement-breakpoint
CREATE TABLE `factsheets` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`entity_type` text DEFAULT 'person' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`promoted_person_id` text,
	`promoted_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`promoted_person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_factsheets_status` ON `factsheets` (`status`);--> statement-breakpoint
CREATE INDEX `idx_factsheets_created_by` ON `factsheets` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_factsheets_promoted_person` ON `factsheets` (`promoted_person_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_research_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text,
	`fact_type` text NOT NULL,
	`fact_value` text NOT NULL,
	`fact_date_sort` integer,
	`research_item_id` text,
	`source_citation_id` text,
	`factsheet_id` text,
	`accepted` integer,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`extraction_method` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`research_item_id`) REFERENCES `research_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_citation_id`) REFERENCES `source_citations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`factsheet_id`) REFERENCES `factsheets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_research_facts`("id", "person_id", "fact_type", "fact_value", "fact_date_sort", "research_item_id", "source_citation_id", "factsheet_id", "accepted", "confidence", "extraction_method", "created_at", "updated_at") SELECT "id", "person_id", "fact_type", "fact_value", "fact_date_sort", "research_item_id", "source_citation_id", "factsheet_id", "accepted", "confidence", "extraction_method", "created_at", "updated_at" FROM `research_facts`;--> statement-breakpoint
DROP TABLE `research_facts`;--> statement-breakpoint
ALTER TABLE `__new_research_facts` RENAME TO `research_facts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_research_facts_person` ON `research_facts` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_research_facts_person_type` ON `research_facts` (`person_id`,`fact_type`);--> statement-breakpoint
CREATE INDEX `idx_research_facts_factsheet` ON `research_facts` (`factsheet_id`);--> statement-breakpoint
CREATE INDEX `idx_families_partner1` ON `families` (`partner1_id`);--> statement-breakpoint
CREATE INDEX `idx_families_partner2` ON `families` (`partner2_id`);