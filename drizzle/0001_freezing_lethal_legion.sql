CREATE TABLE `outcome_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`outcome_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outcome_metrics_outcome_sort_idx` ON `outcome_metrics` (`outcome_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `assumption_tests` ADD `owner_role` text;--> statement-breakpoint
ALTER TABLE `assumption_tests` ADD `test_description` text;--> statement-breakpoint
ALTER TABLE `assumption_tests` ADD `success_criteria` text;--> statement-breakpoint
ALTER TABLE `assumption_tests` ADD `progress_notes` text;--> statement-breakpoint
ALTER TABLE `assumption_tests` ADD `verdict` text;--> statement-breakpoint
ALTER TABLE `assumption_tests` ADD `evidence` text;--> statement-breakpoint
ALTER TABLE `ost_nodes` ADD `description` text;--> statement-breakpoint
ALTER TABLE `ost_nodes` ADD `assumption_type` text;