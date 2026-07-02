import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ai_provider_configs')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('learner_id', 'varchar(36)', (col) => col.notNull().references('learners.id').onDelete('cascade'))
    .addColumn('provider', sql`enum('openai','anthropic','google','nvidia_free','other')`, (col) =>
      col.notNull(),
    )
    .addColumn('model', 'varchar(128)', (col) => col.notNull())
    .addColumn('api_key_encrypted', 'varbinary(2048)')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .execute();

  await db.schema
    .createTable('learner_languages')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('learner_id', 'varchar(36)', (col) => col.notNull().references('learners.id').onDelete('cascade'))
    .addColumn('language_code', 'varchar(16)', (col) => col.notNull())
    .addColumn('current_level', sql`enum('A1','A2','B1','B2','C1','C2')`, (col) =>
      col.notNull().defaultTo('A1'),
    )
    .addColumn('level_updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .addColumn('ai_provider_id', 'varchar(36)', (col) => col.references('ai_provider_configs.id').onDelete('set null'))
    .addUniqueConstraint('learner_languages_learner_lang_uq', ['learner_id', 'language_code'])
    .execute();

  await db.schema
    .alterTable('learners')
    .addForeignKeyConstraint('learners_default_language_fk', ['default_language_id'], 'learner_languages', ['id'])
    .onDelete('set null')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('learners').dropConstraint('learners_default_language_fk').execute();
  await db.schema.dropTable('learner_languages').execute();
  await db.schema.dropTable('ai_provider_configs').execute();
}
