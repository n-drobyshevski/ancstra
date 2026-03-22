CREATE TABLE `tree_layouts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`layout_data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
