CREATE TABLE `assumption_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`assumption_node_id` text NOT NULL,
	`solution_node_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`test_type` text NOT NULL,
	`owner` text,
	`due_date` text,
	`result` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`review_priority` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assumption_tests_solution_priority_idx` ON `assumption_tests` (`solution_node_id`,`review_priority`);--> statement-breakpoint
CREATE INDEX `assumption_tests_assumption_priority_idx` ON `assumption_tests` (`assumption_node_id`,`review_priority`);--> statement-breakpoint
CREATE TABLE `ost_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`outcome_id` text NOT NULL,
	`parent_id` text,
	`node_type` text NOT NULL,
	`title` text NOT NULL,
	`status` text,
	`owner` text,
	`confidence` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`review_priority` integer DEFAULT 0 NOT NULL,
	`is_focus` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ost_nodes_parent_sort_idx` ON `ost_nodes` (`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `ost_nodes_outcome_type_priority_idx` ON `ost_nodes` (`outcome_id`,`node_type`,`review_priority`);--> statement-breakpoint
CREATE INDEX `ost_nodes_focus_idx` ON `ost_nodes` (`outcome_id`,`node_type`,`is_focus`);