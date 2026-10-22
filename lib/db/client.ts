// One SQLite connection for the whole process. Migrations in ./drizzle run on first use,
// so a fresh checkout works with no setup step. DB_PATH can point demo mode at another file.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "newsroom.db");

type Db = ReturnType<typeof drizzle<typeof schema>>;
const globalForDb = globalThis as unknown as { __newsroomDb?: Db; __newsroomSqlite?: Database.Database };

function open(): Db {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  globalForDb.__newsroomSqlite = sqlite;
  return db;
}

export const db: Db = globalForDb.__newsroomDb ?? (globalForDb.__newsroomDb = open());
export { schema };
export const dbPath = DB_PATH;
