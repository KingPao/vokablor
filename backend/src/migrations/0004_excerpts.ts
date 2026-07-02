import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('source_excerpts')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('language_code', 'varchar(16)', (col) => col.notNull())
    .addColumn('source_type', sql`enum('news','tv_show','game')`, (col) => col.notNull())
    .addColumn('source_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('source_url', 'varchar(2048)', (col) => col.notNull())
    .addColumn('snippet_text', 'varchar(1000)', (col) => col.notNull())
    .addColumn('level', sql`enum('A1','A2','B1','B2','C1','C2')`, (col) => col.notNull())
    .addColumn('fetched_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .execute();

  await db.schema
    .createIndex('source_excerpts_lang_level_idx')
    .on('source_excerpts')
    .columns(['language_code', 'level'])
    .execute();

  await db.schema
    .createTable('vocabulary_excerpt_matches')
    .addColumn('vocabulary_item_id', 'varchar(36)', (col) =>
      col.notNull().references('vocabulary_items.id').onDelete('cascade'),
    )
    .addColumn('source_excerpt_id', 'varchar(36)', (col) =>
      col.notNull().references('source_excerpts.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('vocabulary_excerpt_matches_pk', ['vocabulary_item_id', 'source_excerpt_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('vocabulary_excerpt_matches').execute();
  await db.schema.dropTable('source_excerpts').execute();
}
