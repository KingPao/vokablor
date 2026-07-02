import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('progress_states')
    .addColumn('learner_language_id', 'varchar(36)', (col) =>
      col.primaryKey().references('learner_languages.id').onDelete('cascade'),
    )
    .addColumn('points', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('current_streak_days', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('last_activity_at', 'timestamp')
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .execute();

  await db.schema
    .createTable('offline_synced_actions')
    .addColumn('idempotency_key', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('learner_id', 'varchar(36)', (col) => col.notNull().references('learners.id').onDelete('cascade'))
    .addColumn('applied_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('offline_synced_actions').execute();
  await db.schema.dropTable('progress_states').execute();
}
