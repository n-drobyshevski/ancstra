CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_usd` real NOT NULL,
	`task_type` text NOT NULL,
	`session_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_usage_user_month` ON `ai_usage` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `proposed_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`relationship_type` text NOT NULL,
	`person1_id` text NOT NULL,
	`person2_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_detail` text,
	`confidence` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`validated_by` text,
	`validated_at` text,
	`rejection_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person1_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person2_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`validated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_proposed_rels_status` ON `proposed_relationships` (`status`);--> statement-breakpoint
CREATE INDEX `idx_proposed_rels_person1` ON `proposed_relationships` (`person1_id`);--> statement-breakpoint
CREATE INDEX `idx_proposed_rels_person2` ON `proposed_relationships` (`person2_id`);--> statement-breakpoint
CREATE TABLE `match_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`source_system` text NOT NULL,
	`external_id` text NOT NULL,
	`external_data` text NOT NULL,
	`match_score` real NOT NULL,
	`match_status` text DEFAULT 'pending' NOT NULL,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_match_candidates_person` ON `match_candidates` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_match_candidates_status` ON `match_candidates` (`match_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_match_candidate` ON `match_candidates` (`person_id`,`source_system`,`external_id`);--> statement-breakpoint
CREATE TABLE `relationship_justifications` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text,
	`child_link_id` text,
	`justification_text` text NOT NULL,
	`source_citation_id` text,
	`author_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_link_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_citation_id`) REFERENCES `source_citations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_justifications_family` ON `relationship_justifications` (`family_id`);--> statement-breakpoint
CREATE INDEX `idx_justifications_child_link` ON `relationship_justifications` (`child_link_id`);