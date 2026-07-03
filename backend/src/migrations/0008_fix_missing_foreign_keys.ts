import type { Kysely } from 'kysely';

/**
 * Fixes a real bug found while testing FR-016 (deleting an AIProviderConfig should revert any
 * LearnerLanguage pointing at it back to null/shared): every `.references(...).onDelete(...)`
 * used as a column builder in migrations 0001-0007 silently produced a bare `REFERENCES`
 * clause with no `FOREIGN KEY` keyword. MySQL parses that but does not enforce it — none of
 * those constraints ever actually existed (verified via `SHOW CREATE TABLE`). The one place
 * that used the table-level `alterTable().addForeignKeyConstraint(...)` builder (migration
 * 0002's `learners_default_language_fk`) worked correctly, which is the pattern this migration
 * uses for everything that was missing it.
 *
 * Past migrations are intentionally left as-is (never rewrite an already-applied migration) —
 * this adds the constraints those migrations should have created, as a new migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const foreignKeys: {
    name: string;
    table: string;
    column: string;
    refTable: string;
    refColumn: string;
    onDelete: 'cascade' | 'set null';
  }[] = [
    { name: 'sessions_learner_id_fk', table: 'sessions', column: 'learner_id', refTable: 'learners', refColumn: 'id', onDelete: 'cascade' },
    { name: 'ai_provider_configs_learner_id_fk', table: 'ai_provider_configs', column: 'learner_id', refTable: 'learners', refColumn: 'id', onDelete: 'cascade' },
    { name: 'learner_languages_learner_id_fk', table: 'learner_languages', column: 'learner_id', refTable: 'learners', refColumn: 'id', onDelete: 'cascade' },
    { name: 'learner_languages_ai_provider_id_fk', table: 'learner_languages', column: 'ai_provider_id', refTable: 'ai_provider_configs', refColumn: 'id', onDelete: 'set null' },
    { name: 'vocabulary_items_learner_language_id_fk', table: 'vocabulary_items', column: 'learner_language_id', refTable: 'learner_languages', refColumn: 'id', onDelete: 'cascade' },
    { name: 'vocab_excerpt_matches_vocab_item_id_fk', table: 'vocabulary_excerpt_matches', column: 'vocabulary_item_id', refTable: 'vocabulary_items', refColumn: 'id', onDelete: 'cascade' },
    { name: 'vocab_excerpt_matches_source_excerpt_id_fk', table: 'vocabulary_excerpt_matches', column: 'source_excerpt_id', refTable: 'source_excerpts', refColumn: 'id', onDelete: 'cascade' },
    { name: 'practice_sessions_learner_language_id_fk', table: 'practice_sessions', column: 'learner_language_id', refTable: 'learner_languages', refColumn: 'id', onDelete: 'cascade' },
    { name: 'speaking_attempts_practice_session_id_fk', table: 'speaking_attempts', column: 'practice_session_id', refTable: 'practice_sessions', refColumn: 'id', onDelete: 'cascade' },
    { name: 'speaking_attempts_vocabulary_item_id_fk', table: 'speaking_attempts', column: 'vocabulary_item_id', refTable: 'vocabulary_items', refColumn: 'id', onDelete: 'cascade' },
    { name: 'conversation_sessions_practice_session_id_fk', table: 'conversation_sessions', column: 'practice_session_id', refTable: 'practice_sessions', refColumn: 'id', onDelete: 'cascade' },
    { name: 'conversation_turns_conversation_session_id_fk', table: 'conversation_turns', column: 'conversation_session_id', refTable: 'conversation_sessions', refColumn: 'id', onDelete: 'cascade' },
    { name: 'progress_states_learner_language_id_fk', table: 'progress_states', column: 'learner_language_id', refTable: 'learner_languages', refColumn: 'id', onDelete: 'cascade' },
    { name: 'offline_synced_actions_learner_id_fk', table: 'offline_synced_actions', column: 'learner_id', refTable: 'learners', refColumn: 'id', onDelete: 'cascade' },
    { name: 'ai_free_tier_usage_learner_id_fk', table: 'ai_free_tier_usage', column: 'learner_id', refTable: 'learners', refColumn: 'id', onDelete: 'cascade' },
  ];

  for (const fk of foreignKeys) {
    let builder = db.schema
      .alterTable(fk.table)
      .addForeignKeyConstraint(fk.name, [fk.column], fk.refTable, [fk.refColumn]);
    builder = fk.onDelete === 'cascade' ? builder.onDelete('cascade') : builder.onDelete('set null');
    await builder.execute();
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const tablesAndConstraints: [string, string][] = [
    ['ai_free_tier_usage', 'ai_free_tier_usage_learner_id_fk'],
    ['offline_synced_actions', 'offline_synced_actions_learner_id_fk'],
    ['progress_states', 'progress_states_learner_language_id_fk'],
    ['conversation_turns', 'conversation_turns_conversation_session_id_fk'],
    ['conversation_sessions', 'conversation_sessions_practice_session_id_fk'],
    ['speaking_attempts', 'speaking_attempts_vocabulary_item_id_fk'],
    ['speaking_attempts', 'speaking_attempts_practice_session_id_fk'],
    ['practice_sessions', 'practice_sessions_learner_language_id_fk'],
    ['vocabulary_excerpt_matches', 'vocab_excerpt_matches_source_excerpt_id_fk'],
    ['vocabulary_excerpt_matches', 'vocab_excerpt_matches_vocab_item_id_fk'],
    ['vocabulary_items', 'vocabulary_items_learner_language_id_fk'],
    ['learner_languages', 'learner_languages_ai_provider_id_fk'],
    ['learner_languages', 'learner_languages_learner_id_fk'],
    ['ai_provider_configs', 'ai_provider_configs_learner_id_fk'],
    ['sessions', 'sessions_learner_id_fk'],
  ];

  for (const [table, constraint] of tablesAndConstraints) {
    await db.schema.alterTable(table).dropConstraint(constraint).execute();
  }
}
