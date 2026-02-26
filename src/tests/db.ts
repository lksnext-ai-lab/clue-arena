/**
 * Test database helper.
 *
 * Creates an in-memory SQLite database with the full schema applied,
 * ready to be used in unit / integration tests.
 *
 * Usage:
 *   import { createTestDb } from '@/tests/db';
 *
 *   const { db, close } = createTestDb();
 *   // ... use db (Drizzle instance) ...
 *   close(); // optional – in-memory DBs are GC'd anyway
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import * as schema from '@/lib/db/schema';

/** Directory that contains all Drizzle migration SQL files. */
const MIGRATIONS_DIR = resolve(__dirname, '../../src/lib/db/migrations');

/**
 * Apply all Drizzle migrations contained in a single SQL file.
 * Drizzle separates statements with `--> statement-breakpoint`.
 */
function applyMigrations(sqlite: Database.Database, sqlPath: string): void {
  const sql = readFileSync(sqlPath, 'utf-8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    sqlite.exec(statement);
  }
}

export interface TestDb {
  /** Drizzle ORM instance backed by an in-memory SQLite database. */
  db: ReturnType<typeof drizzle<typeof schema>>;
  /** Underlying better-sqlite3 instance (for raw SQL when needed). */
  sqlite: Database.Database;
  /** Close the database connection. Safe to call multiple times. */
  close: () => void;
}

/**
 * Create a fresh, isolated in-memory SQLite database with the full
 * application schema already applied.
 *
 * Each call returns an independent database — ideal for test isolation.
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');

  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = MEMORY');

  // Apply all migrations in alphabetical order
  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    applyMigrations(sqlite, resolve(MIGRATIONS_DIR, file));
  }

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => {
      try {
        sqlite.close();
      } catch {
        // already closed
      }
    },
  };
}
