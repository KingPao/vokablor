import 'dotenv/config';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { db } from '../db/client.js';

const migrationFolder = path.dirname(fileURLToPath(import.meta.url));

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
  }),
});

async function main(): Promise<void> {
  const direction = process.argv[2] ?? 'up';
  const { error, results } =
    direction === 'down' ? await migrator.migrateDown() : await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`✔ migration "${result.migrationName}" ${result.direction}`);
    } else if (result.status === 'Error') {
      console.error(`✘ migration "${result.migrationName}" failed`);
    }
  }

  if (error) {
    console.error('Migration run failed:', error);
    await db.destroy();
    process.exit(1);
  }

  await db.destroy();
}

main();
