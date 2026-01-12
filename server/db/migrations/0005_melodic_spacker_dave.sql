CREATE INDEX `buttons_name_index` ON `buttons` (`name`);--> statement-breakpoint
CREATE INDEX `buttons_parent_id_index` ON `buttons` (`parent_id`);--> statement-breakpoint
CREATE INDEX `buttons_discovered_by_index` ON `buttons` (`discovered_by`);--> statement-breakpoint
CREATE INDEX `buttons_created_at_index` ON `buttons` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `messages_created_at_index` ON `messages` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `messages_updated_at_index` ON `messages` ("updated_at" desc);