import * as vocabularyModel from '../models/vocabulary-item.js';
import type { MasteryState, VocabularyOrigin } from '../db/schema.js';
import type { VocabularyItem } from '../models/vocabulary-item.js';

export class VocabularyError extends Error {}

const MASTERY_ORDER: MasteryState[] = ['new', 'learning', 'reviewing', 'mastered'];
// Days until next review at each mastery level, once an answer lands the item at that level.
const REVIEW_INTERVAL_DAYS: Record<MasteryState, number> = { new: 1, learning: 3, reviewing: 7, mastered: 30 };

/** FR-005: reuses an existing (learnerLanguageId, term) entry rather than inserting a duplicate. */
export async function addVocabulary(
  learnerLanguageId: string,
  term: string,
  translation: string,
  origin: VocabularyOrigin,
): Promise<VocabularyItem> {
  const trimmedTerm = term.trim();
  if (!trimmedTerm || !translation.trim()) {
    throw new VocabularyError('term and translation are required');
  }
  const existing = await vocabularyModel.findByTerm(learnerLanguageId, trimmedTerm);
  if (existing) return existing;
  return vocabularyModel.create(learnerLanguageId, trimmedTerm, translation.trim(), origin);
}

export async function editVocabulary(
  id: string,
  changes: { term?: string; translation?: string },
): Promise<VocabularyItem> {
  const updated = await vocabularyModel.update(id, changes);
  if (!updated) throw new VocabularyError('Vocabulary item not found');
  return updated;
}

export async function deleteVocabulary(id: string): Promise<void> {
  await vocabularyModel.remove(id);
}

export async function listVocabulary(learnerLanguageId: string, dueOnly = false): Promise<VocabularyItem[]> {
  return vocabularyModel.list(learnerLanguageId, { dueOnly });
}

/**
 * Moves mastery one step per answer — advances on correct, retreats on incorrect — which
 * structurally satisfies "a wrong answer moves it back at most one step, never straight to
 * new" (data-model.md) since retreating one index from `reviewing` lands on `learning`, not
 * `new`.
 */
export function nextMasteryState(current: MasteryState, correct: boolean): MasteryState {
  const index = MASTERY_ORDER.indexOf(current);
  const nextIndex = correct ? Math.min(index + 1, MASTERY_ORDER.length - 1) : Math.max(index - 1, 0);
  return MASTERY_ORDER[nextIndex] as MasteryState;
}

export function nextReviewDate(masteryState: MasteryState, correct: boolean, now = new Date()): Date {
  if (!correct) {
    return new Date(now.getTime() + 60 * 60 * 1000); // due again in an hour
  }
  const days = REVIEW_INTERVAL_DAYS[masteryState];
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Applies one training/speaking answer's effect on a word's mastery + review schedule. */
export async function applyAnswer(item: VocabularyItem, correct: boolean): Promise<VocabularyItem> {
  const masteryState = nextMasteryState(item.masteryState, correct);
  const nextReviewAt = nextReviewDate(masteryState, correct);
  await vocabularyModel.updateMasteryAndSchedule(item.id, masteryState, nextReviewAt);
  return { ...item, masteryState, nextReviewAt };
}
