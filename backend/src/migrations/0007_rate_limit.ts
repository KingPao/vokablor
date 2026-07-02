import type { Kysely } from 'kysely';

/**
 * Operational table backing the per-learner shared free-tier rate limiter (research.md #6).
 * Not a spec-level domain entity (data-model.md), so it's a separate migration from the
 * core schema — MySQL-backed rather than in-memory because the app may run multiple
 * container replicas behind the reverse proxy.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ai_free_tier_usage')
    .addColumn('learner_id', 'varchar(36)', (col) =>
      col.notNull().references('learners.id').onDelete('cascade'),
    )
    .addColumn('window_start', 'date', (col) => col.notNull())
    .addColumn('request_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('ai_free_tier_usage_pk', ['learner_id', 'window_start'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('ai_free_tier_usage').execute();
}
