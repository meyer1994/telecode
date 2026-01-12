ALTER TABLE `messages` ADD `created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL;