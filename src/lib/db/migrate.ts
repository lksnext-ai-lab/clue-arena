import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index';

const migrationsFolder = './src/lib/db/migrations';

export function runMigrations() {
  migrate(db, { migrationsFolder });
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  console.log(`> [db] Applying runtime migrations from ${migrationsFolder}...`);
  runMigrations();
  console.log('> [db] Runtime migrations applied.');
}
