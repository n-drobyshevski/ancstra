PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_proposed_relationships` (
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
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`person1_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person2_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "proposed_relationships_status_check" CHECK("__new_proposed_relationships"."status" IN ('pending', 'validated', 'rejected', 'needs_info'))
);
--> statement-breakpoint
INSERT INTO `__new_proposed_relationships`("id", "relationship_type", "person1_id", "person2_id", "source_type", "source_detail", "confidence", "status", "validated_by", "validated_at", "rejection_reason", "created_at", "updated_at", "version") SELECT "id", "relationship_type", "person1_id", "person2_id", "source_type", "source_detail", "confidence", "status", "validated_by", "validated_at", "rejection_reason", "created_at", "updated_at", "version" FROM `proposed_relationships`;--> statement-breakpoint
DROP TABLE `proposed_relationships`;--> statement-breakpoint
ALTER TABLE `__new_proposed_relationships` RENAME TO `proposed_relationships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_proposed_rels_status` ON `proposed_relationships` (`status`);--> statement-breakpoint
CREATE INDEX `idx_proposed_rels_person1` ON `proposed_relationships` (`person1_id`);--> statement-breakpoint
CREATE INDEX `idx_proposed_rels_person2` ON `proposed_relationships` (`person2_id`);