import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DEFAULT_DATABASE_PATH = path.join(
  process.cwd(),
  "data",
  "review-command-center.sqlite",
);

let sqlite: Database.Database | null = null;

export function getSqlite() {
  if (sqlite) {
    return sqlite;
  }

  const databasePath = process.env.REVIEW_DB_PATH ?? DEFAULT_DATABASE_PATH;
  mkdirSync(path.dirname(databasePath), { recursive: true });

  sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return sqlite;
}

export function getDb() {
  return drizzle(getSqlite(), { schema });
}
