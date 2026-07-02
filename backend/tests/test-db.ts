import 'dotenv/config';
import { sql } from 'kysely';
import { db } from '../src/db/client.js';

/** Truncates every domain table between tests so each test starts from a clean slate. */
export async function resetDb(): Promise<void> {
  await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db);
  const tables = [
    'ai_free_tier_usage',
    'offline_synced_actions',
    'conversation_turns',
    'conversation_sessions',
    'speaking_attempts',
    'practice_sessions',
    'progress_states',
    'vocabulary_excerpt_matches',
    'source_excerpts',
    'vocabulary_items',
    'learner_languages',
    'ai_provider_configs',
    'sessions',
    'learners',
  ];
  for (const table of tables) {
    await sql`TRUNCATE TABLE ${sql.raw(table)}`.execute(db);
  }
  await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db);
}
