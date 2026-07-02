import { createPool } from 'mysql2';
import { Kysely, MysqlDialect } from 'kysely';
import type { Database } from './schema.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const pool = createPool({
  host: process.env.MYSQL_HOST ?? 'localhost',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: requireEnv('MYSQL_DATABASE'),
  user: requireEnv('MYSQL_USER'),
  password: requireEnv('MYSQL_PASSWORD'),
  connectionLimit: 10,
  supportBigNumbers: true,
});

export const db = new Kysely<Database>({
  dialect: new MysqlDialect({ pool }),
});

export async function closeDb(): Promise<void> {
  await db.destroy();
}
