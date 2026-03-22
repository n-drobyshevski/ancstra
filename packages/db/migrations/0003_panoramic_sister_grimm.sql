CREATE TABLE `research_canvas_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`node_type` text NOT NULL,
	`node_id` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_canvas_positions_person` ON `research_canvas_positions` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_canvas_person_node` ON `research_canvas_positions` (`person_id`,`node_type`,`node_id`);--> statement-breakpoint
CREATE TABLE `research_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`fact_type` text NOT NULL,
	`fact_value` text NOT NULL,
	`fact_date_sort` integer,
	`research_item_id` text,
	`source_citation_id` text,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`extraction_method` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`research_item_id`) REFERENCES `research_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_citation_id`) REFERENCES `source_citations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_research_facts_person` ON `research_facts` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_research_facts_person_type` ON `research_facts` (`person_id`,`fact_type`);--> statement-breakpoint
CREATE TABLE `research_item_persons` (
	`research_item_id` text NOT NULL,
	`person_id` text NOT NULL,
	PRIMARY KEY(`research_item_id`, `person_id`),
	FOREIGN KEY (`research_item_id`) REFERENCES `research_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_research_item_persons_person` ON `research_item_persons` (`person_id`);--> statement-breakpoint
CREATE TABLE `research_items` (
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
	`status` text DEFAULT 'draft' NOT NULL,
	`promoted_source_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `search_providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promoted_source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_research_items_status` ON `research_items` (`status`);--> statement-breakpoint
CREATE INDEX `idx_research_items_provider` ON `research_items` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_research_items_created_by` ON `research_items` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_research_items_created_at` ON `research_items` (`created_at`);--> statement-breakpoint
CREATE TABLE `search_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider_type` text NOT NULL,
	`base_url` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`config` text,
	`rate_limit_rpm` integer DEFAULT 30 NOT NULL,
	`health_status` text DEFAULT 'unknown' NOT NULL,
	`last_health_check` text,
	`created_at` text NOT NULL
);
