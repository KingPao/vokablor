import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import type { ProficiencyLevel } from '../db/schema.js';
import { ensureProgressState } from './progress-state.js';
import { findMostRecent as findMostRecentAiProviderConfig } from './ai-provider-config.js';

export interface LearnerLanguage {
  id: string;
  learnerId: string;
  languageCode: string;
  currentLevel: ProficiencyLevel;
  levelUpdatedAt: Date;
  aiProviderId: string | null;
}

function toLearnerLanguage(row: {
  id: string;
  learner_id: string;
  language_code: string;
  current_level: ProficiencyLevel;
  level_updated_at: Date;
  ai_provider_id: string | null;
}): LearnerLanguage {
  return {
    id: row.id,
    learnerId: row.learner_id,
    languageCode: row.language_code,
    currentLevel: row.current_level,
    levelUpdatedAt: row.level_updated_at,
    aiProviderId: row.ai_provider_id,
  };
}

export async function findLearnerLanguage(learnerId: string, languageCode: string): Promise<LearnerLanguage | null> {
  const row = await db
    .selectFrom('learner_languages')
    .selectAll()
    .where('learner_id', '=', learnerId)
    .where('language_code', '=', languageCode)
    .executeTakeFirst();
  return row ? toLearnerLanguage(row) : null;
}

export async function findLearnerLanguageById(id: string): Promise<LearnerLanguage | null> {
  const row = await db.selectFrom('learner_languages').selectAll().where('id', '=', id).executeTakeFirst();
  return row ? toLearnerLanguage(row) : null;
}

export async function listLearnerLanguages(learnerId: string): Promise<LearnerLanguage[]> {
  const rows = await db
    .selectFrom('learner_languages')
    .selectAll()
    .where('learner_id', '=', learnerId)
    .execute();
  return rows.map(toLearnerLanguage);
}

/**
 * FR-021: one independent level-track per (learner, language) — reused, never duplicated.
 * Uses `ON DUPLICATE KEY UPDATE` (a race-free upsert) rather than check-then-insert: two
 * concurrent first-time requests for the same (learner, language) — e.g. a page loading its
 * vocabulary list and its progress indicator at once — must not violate the unique
 * constraint on (learner_id, language_code).
 */
export async function ensureLearnerLanguage(learnerId: string, languageCode: string): Promise<LearnerLanguage> {
  // Best-effort only (not part of the race-safety guarantee below): if this learner already
  // has an AI provider configured, a brand-new language should start using it too, rather
  // than silently defaulting to the shared provider until they notice and fix it (FR-016).
  const existing = await findLearnerLanguage(learnerId, languageCode);
  const aiProviderId = existing ? undefined : (await findMostRecentAiProviderConfig(learnerId))?.id ?? null;

  const id = existing?.id ?? randomUUID();
  await db
    .insertInto('learner_languages')
    .values({ id, learner_id: learnerId, language_code: languageCode, ...(aiProviderId !== undefined ? { ai_provider_id: aiProviderId } : {}) })
    .onDuplicateKeyUpdate({ learner_id: learnerId })
    .execute();

  const created = await findLearnerLanguage(learnerId, languageCode);
  if (!created) throw new Error('Failed to create learner language');
  await ensureProgressState(created.id);
  return created;
}

export async function updateLevel(id: string, level: ProficiencyLevel): Promise<void> {
  await db
    .updateTable('learner_languages')
    .set({ current_level: level, level_updated_at: new Date() })
    .where('id', '=', id)
    .execute();
}

/**
 * FR-016: applies a learner's configured AI provider across every language they're
 * studying — "I added my own key" means "use it everywhere for me", not a per-language
 * setting the learner has no UI to manage separately.
 */
export async function setAiProviderForAllLanguages(learnerId: string, aiProviderConfigId: string | null): Promise<void> {
  await db
    .updateTable('learner_languages')
    .set({ ai_provider_id: aiProviderConfigId })
    .where('learner_id', '=', learnerId)
    .execute();
}
