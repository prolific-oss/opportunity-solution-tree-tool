import type Database from "better-sqlite3";
import { getSqlite } from "@/db";

type ColumnSpec = Record<string, string>;

let reviewStoragePromise: Promise<void> | null = null;

async function ensureColumns(
  database: Database.Database,
  tableName: "assumption_tests" | "ost_nodes",
  columns: ColumnSpec,
) {
  const pragma = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  const existing = new Set(pragma.map((row) => String(row.name)));

  for (const [columnName, sqlDefinition] of Object.entries(columns)) {
    if (existing.has(columnName)) {
      continue;
    }

    database
      .prepare(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlDefinition}`,
      )
      .run();
  }
}

async function initializeReviewStorage() {
  const database = getSqlite();

  database.exec(`
    CREATE TABLE IF NOT EXISTS ost_nodes (id TEXT PRIMARY KEY, outcome_id TEXT NOT NULL, parent_id TEXT, node_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, assumption_type TEXT, status TEXT, owner TEXT, confidence INTEGER, sort_order INTEGER NOT NULL DEFAULT 0, review_priority INTEGER NOT NULL DEFAULT 0, is_focus INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS assumption_tests (id TEXT PRIMARY KEY, assumption_node_id TEXT NOT NULL, solution_node_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, test_type TEXT NOT NULL, owner TEXT, owner_role TEXT, due_date TEXT, test_description TEXT, success_criteria TEXT, progress_notes TEXT, verdict TEXT, evidence TEXT, result TEXT, sort_order INTEGER NOT NULL DEFAULT 0, review_priority INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS outcome_metrics (id TEXT PRIMARY KEY, outcome_id TEXT NOT NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS ost_nodes_parent_sort_idx ON ost_nodes (parent_id, sort_order);
    CREATE INDEX IF NOT EXISTS ost_nodes_outcome_type_priority_idx ON ost_nodes (outcome_id, node_type, review_priority);
    CREATE INDEX IF NOT EXISTS ost_nodes_focus_idx ON ost_nodes (outcome_id, node_type, is_focus);
    CREATE INDEX IF NOT EXISTS assumption_tests_solution_priority_idx ON assumption_tests (solution_node_id, review_priority);
    CREATE INDEX IF NOT EXISTS assumption_tests_assumption_priority_idx ON assumption_tests (assumption_node_id, review_priority);
    CREATE INDEX IF NOT EXISTS outcome_metrics_outcome_sort_idx ON outcome_metrics (outcome_id, sort_order);
    CREATE INDEX IF NOT EXISTS team_members_sort_idx ON team_members (sort_order, name);
  `);

  await ensureColumns(database, "ost_nodes", {
    description: "TEXT",
    assumption_type: "TEXT",
  });

  await ensureColumns(database, "assumption_tests", {
    owner_role: "TEXT",
    test_description: "TEXT",
    success_criteria: "TEXT",
    progress_notes: "TEXT",
    verdict: "TEXT",
    evidence: "TEXT",
  });
}

export async function ensureReviewStorage() {
  reviewStoragePromise ??= initializeReviewStorage().catch((error: unknown) => {
    reviewStoragePromise = null;
    throw error;
  });

  return reviewStoragePromise;
}
