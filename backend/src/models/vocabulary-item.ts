import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import type { MasteryState, VocabularyOrigin } from '../db/schema.js';

export interface VocabularyItem {
  id: string;
  learnerLanguageId: string;
  term: string;
  translation: string;
  origin: VocabularyOrigin;
  masteryState: MasteryState;
  nextReviewAt: Date | null;
  createdAt: Date;
}

function toVocabularyItem(row: {
  id: string;
  learner_language_id: string;
  term: string;
  translation: string;
  origin: VocabularyOrigin;
  mastery_state: MasteryState;
  next_review_at: Date | null;
  created_at: Date;
}): VocabularyItem {
  return {
    id: row.id,
    learnerLanguageId: row.learner_language_id,
    term: row.term,
    translation: row.translation,
    origin: row.origin,
    masteryState: row.mastery_state,
    nextReviewAt: row.next_review_at,
    createdAt: row.created_at,
  };
}

export async function findById(id: string): Promise<VocabularyItem | null> {
  const row = await db.selectFrom('vocabulary_items').selectAll().where('id', '=', id).executeTakeFirst();
  return row ? toVocabularyItem(row) : null;
}

/** FR-005: the lookup half of "reuse instead of duplicate" — dedupe by (learnerLanguageId, term). */
export async function findByTerm(learnerLanguageId: string, term: string): Promise<VocabularyItem | null> {
  const row = await db
    .selectFrom('vocabulary_items')
    .selectAll()
    .where('learner_language_id', '=', learnerLanguageId)
    .where('term', '=', term)
    .executeTakeFirst();
  return row ? toVocabularyItem(row) : null;
}

export async function list(learnerLanguageId: string, opts: { dueOnly?: boolean } = {}): Promise<VocabularyItem[]> {
  let query = db.selectFrom('vocabulary_items').selectAll().where('learner_language_id', '=', learnerLanguageId);
  if (opts.dueOnly) {
    query = query.where(({ or, eb }) => or([eb('next_review_at', 'is', null), eb('next_review_at', '<=', new Date())]));
  }
  return (await query.execute()).map(toVocabularyItem);
}

export async function create(
  learnerLanguageId: string,
  term: string,
  translation: string,
  origin: VocabularyOrigin,
): Promise<VocabularyItem> {
  const id = randomUUID();
  await db
    .insertInto('vocabulary_items')
    .values({ id, learner_language_id: learnerLanguageId, term, translation, origin })
    .execute();
  const created = await findById(id);
  if (!created) throw new Error('Failed to create vocabulary item');
  return created;
}

export async function update(
  id: string,
  changes: { term?: string; translation?: string },
): Promise<VocabularyItem | null> {
  if (Object.keys(changes).length > 0) {
    await db.updateTable('vocabulary_items').set(changes).where('id', '=', id).execute();
  }
  return findById(id);
}

export async function remove(id: string): Promise<void> {
  await db.deleteFrom('vocabulary_items').where('id', '=', id).execute();
}

export async function updateMasteryAndSchedule(
  id: string,
  masteryState: MasteryState,
  nextReviewAt: Date | null,
): Promise<void> {
  await db
    .updateTable('vocabulary_items')
    .set({ mastery_state: masteryState, next_review_at: nextReviewAt })
    .where('id', '=', id)
    .execute();
}
