ALTER TABLE `events` ADD `source_factsheet_id` text;--> statement-breakpoint
CREATE INDEX `idx_events_source_factsheet` ON `events` (`source_factsheet_id`);