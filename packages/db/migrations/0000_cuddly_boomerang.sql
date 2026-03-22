CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`person_id` text NOT NULL,
	`child_order` integer,
	`relationship_to_parent1` text DEFAULT 'biological' NOT NULL,
	`relationship_to_parent2` text DEFAULT 'biological' NOT NULL,
	`validation_status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_children_family` ON `children` (`family_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `idx_children_person` ON `children` (`person_id`,`family_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_children_family_person` ON `children` (`family_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`date_original` text,
	`date_sort` integer,
	`date_modifier` text DEFAULT 'exact',
	`date_end_sort` integer,
	`place_text` text,
	`description` text,
	`person_id` text,
	`family_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_person` ON `events` (`person_id`,`date_sort`);--> statement-breakpoint
CREATE INDEX `idx_events_family` ON `events` (`family_id`);--> statement-breakpoint
CREATE INDEX `idx_events_type` ON `events` (`event_type`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`partner1_id` text,
	`partner2_id` text,
	`relationship_type` text DEFAULT 'unknown' NOT NULL,
	`validation_status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`partner1_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`partner2_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `person_names` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`name_type` text DEFAULT 'birth' NOT NULL,
	`prefix` text,
	`given_name` text NOT NULL,
	`surname` text NOT NULL,
	`suffix` text,
	`nickname` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_person_names_person` ON `person_names` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_person_names_name` ON `person_names` (`surname`,`given_name`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` text PRIMARY KEY NOT NULL,
	`sex` text DEFAULT 'U' NOT NULL,
	`is_living` integer DEFAULT true NOT NULL,
	`privacy_level` text DEFAULT 'private' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_persons_sex` ON `persons` (`sex`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);