import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('learners')
    .addColumn('id', 'varchar(36)', (col) => col.primaryKey())
    .addColumn('email', 'varchar(320)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .addColumn('default_language_id', 'varchar(36)')
    .execute();

  await db.schema
    .createTable('sessions')
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('learner_id', 'varchar(36)', (col) => col.notNull().references('learners.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`current_timestamp`))
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .execute();

  await db.schema.createIndex('sessions_learner_id_idx').on('sessions').column('learner_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sessions').execute();
  await db.schema.dropTable('learners').execute();
}
