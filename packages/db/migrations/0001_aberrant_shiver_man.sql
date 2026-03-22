CREATE TABLE `source_citations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`citation_detail` text,
	`citation_text` text,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`person_id` text,
	`event_id` text,
	`family_id` text,
	`person_name_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_name_id`) REFERENCES `person_names`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_citations_source` ON `source_citations` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_citations_person` ON `source_citations` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_citations_event` ON `source_citations` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_citations_family` ON `source_citations` (`family_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`publisher` text,
	`publication_date` text,
	`repository_name` text,
	`repository_url` text,
	`source_type` text,
	`notes` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
