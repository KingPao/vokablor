import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('vocabulary_items')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('learner_language_id', 'varchar(36)', (col) =>
      col.notNull().references('learner_languages.id').onDelete('cascade'),
    )
    .addColumn('term', 'varchar(255)', (col) => col.notNull())
    .addColumn('translation', 'varchar(512)', (col) => col.notNull())
    .addColumn('origin', sql`enum('user_added','app_discovered')`, (col) => col.notNull())
    .addColumn('mastery_state', sql`enum('new','learning','reviewing','mastered')`, (col) =>
      col.notNull().defaultTo('new'),
    )
    .addColumn('next_review_at', 'timestamp')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .addUniqueConstraint('vocabulary_items_lang_term_uq', ['learner_language_id', 'term'])
    .execute();

  await db.schema
    .createIndex('vocabulary_items_due_idx')
    .on('vocabulary_items')
    .columns(['learner_language_id', 'next_review_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('vocabulary_items').execute();
}
