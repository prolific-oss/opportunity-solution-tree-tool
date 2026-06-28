import { integer, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ostNodes = sqliteTable(
  "ost_nodes",
  {
    id: text("id").primaryKey(),
    outcomeId: text("outcome_id").notNull(),
    parentId: text("parent_id"),
    nodeType: text("node_type", {
      enum: ["outcome", "opportunity", "solution", "assumption"],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    assumptionType: text("assumption_type", {
      enum: ["desirability", "feasibility", "usability", "viability", "ethical"],
    }),
    status: text("status"),
    owner: text("owner"),
    confidence: integer("confidence"),
    sortOrder: integer("sort_order").notNull().default(0),
    reviewPriority: integer("review_priority").notNull().default(0),
    isFocus: integer("is_focus", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    parentSortIdx: index("ost_nodes_parent_sort_idx").on(
      table.parentId,
      table.sortOrder,
    ),
    outcomeTypePriorityIdx: index("ost_nodes_outcome_type_priority_idx").on(
      table.outcomeId,
      table.nodeType,
      table.reviewPriority,
    ),
    focusIdx: index("ost_nodes_focus_idx").on(
      table.outcomeId,
      table.nodeType,
      table.isFocus,
    ),
  }),
);

export const assumptionTests = sqliteTable(
  "assumption_tests",
  {
    id: text("id").primaryKey(),
    assumptionNodeId: text("assumption_node_id").notNull(),
    solutionNodeId: text("solution_node_id").notNull(),
    title: text("title").notNull(),
    status: text("status", {
      enum: ["not_started", "in_progress", "done"],
    }).notNull(),
    assumptionType: text("test_type", {
      enum: ["desirability", "feasibility", "usability", "viability", "ethical"],
    }).notNull(),
    owner: text("owner"),
    ownerRole: text("owner_role"),
    dueDate: text("due_date"),
    testDescription: text("test_description"),
    successCriteria: text("success_criteria"),
    progressNotes: text("progress_notes"),
    verdict: text("verdict", {
      enum: ["validated", "invalidated"],
    }),
    evidence: text("evidence"),
    result: text("result"),
    sortOrder: integer("sort_order").notNull().default(0),
    reviewPriority: integer("review_priority").notNull().default(0),
  },
  (table) => ({
    solutionPriorityIdx: index("assumption_tests_solution_priority_idx").on(
      table.solutionNodeId,
      table.reviewPriority,
    ),
    assumptionPriorityIdx: index("assumption_tests_assumption_priority_idx").on(
      table.assumptionNodeId,
      table.reviewPriority,
    ),
  }),
);

export const outcomeMetrics = sqliteTable(
  "outcome_metrics",
  {
    id: text("id").primaryKey(),
    outcomeId: text("outcome_id").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    outcomeSortIdx: index("outcome_metrics_outcome_sort_idx").on(
      table.outcomeId,
      table.sortOrder,
    ),
  }),
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    role: text("role"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    sortIdx: index("team_members_sort_idx").on(table.sortOrder, table.name),
  }),
);
