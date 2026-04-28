ALTER TABLE `person_summary` ADD `has_name` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `has_birth_event` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `has_birth_place` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `has_death_event` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `has_source` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `sources_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `completeness` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `validation` text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE `person_summary` ADD `updated_at_sort` text;--> statement-breakpoint
CREATE INDEX `idx_person_summary_validation` ON `person_summary` (`validation`);--> statement-breakpoint
CREATE INDEX `idx_person_summary_completeness` ON `person_summary` (`completeness`);--> statement-breakpoint
CREATE INDEX `idx_person_summary_birth_sort` ON `person_summary` (`birth_date_sort`);--> statement-breakpoint
CREATE INDEX `idx_person_summary_death_sort` ON `person_summary` (`death_date_sort`);--> statement-breakpoint
CREATE INDEX `idx_person_summary_sources_count` ON `person_summary` (`sources_count`);--> statement-breakpoint
CREATE INDEX `idx_person_summary_updated_sort` ON `person_summary` (`updated_at_sort`);--> statement-breakpoint
CREATE INDEX `idx_events_person_type` ON `events` (`person_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `idx_families_deleted` ON `families` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_persons_deleted_created` ON `persons` (`deleted_at`,`created_at`);