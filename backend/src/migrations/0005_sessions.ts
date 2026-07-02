import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('practice_sessions')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('learner_language_id', 'varchar(36)', (col) =>
      col.notNull().references('learner_languages.id').onDelete('cascade'),
    )
    .addColumn('mode', sql`enum('training','speaking','conversation')`, (col) => col.notNull())
    .addColumn('started_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .addColumn('ended_at', 'timestamp')
    .addColumn('outcome_summary', 'json')
    .execute();

  await db.schema
    .createIndex('practice_sessions_lang_mode_idx')
    .on('practice_sessions')
    .columns(['learner_language_id', 'mode'])
    .execute();

  await db.schema
    .createTable('speaking_attempts')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('practice_session_id', 'varchar(36)', (col) =>
      col.notNull().references('practice_sessions.id').onDelete('cascade'),
    )
    .addColumn('vocabulary_item_id', 'varchar(36)', (col) =>
      col.notNull().references('vocabulary_items.id').onDelete('cascade'),
    )
    .addColumn('audio_ref', 'varchar(512)', (col) => col.notNull())
    .addColumn('transcript', 'text')
    .addColumn('evaluation_result', sql`enum('correct','corrected','could_not_evaluate')`, (col) =>
      col.notNull(),
    )
    .addColumn('correction_detail', 'text')
    .addColumn('confidence', 'real')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .execute();

  await db.schema
    .createTable('conversation_sessions')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('practice_session_id', 'varchar(36)', (col) =>
      col.notNull().unique().references('practice_sessions.id').onDelete('cascade'),
    )
    .execute();

  await db.schema
    .createTable('conversation_turns')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('conversation_session_id', 'varchar(36)', (col) =>
      col.notNull().references('conversation_sessions.id').onDelete('cascade'),
    )
    .addColumn('speaker', sql`enum('learner','ai')`, (col) => col.notNull())
    .addColumn('turn_index', 'integer', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('flagged_new_vocabulary', 'json')
    .addColumn('correction_detail', 'text')
    .execute();

  await db.schema
    .createIndex('conversation_turns_session_idx')
    .on('conversation_turns')
    .columns(['conversation_session_id', 'turn_index'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('conversation_turns').execute();
  await db.schema.dropTable('conversation_sessions').execute();
  await db.schema.dropTable('speaking_attempts').execute();
  await db.schema.dropTable('practice_sessions').execute();
}
