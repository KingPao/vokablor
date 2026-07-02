import * as practiceSessionModel from '../models/practice-session.js';
import * as vocabularyModel from '../models/vocabulary-item.js';
import { applyAnswer } from './vocabulary-service.js';
import { recordActivity } from '../models/progress-state.js';
import type { VocabularyItem } from '../models/vocabulary-item.js';

const POINTS_CORRECT = 10;
const POINTS_INCORRECT = 2; // participation still counts toward the streak (FR-017)

export class TrainingError extends Error {}

export async function startTrainingSession(
  learnerLanguageId: string,
): Promise<{ sessionId: string; dueItems: VocabularyItem[] }> {
  const session = await practiceSessionModel.start(learnerLanguageId, 'training');
  const dueItems = await vocabularyModel.list(learnerLanguageId, { dueOnly: true });
  return { sessionId: session.id, dueItems };
}

/** FR-006 (mastery update) + FR-017 (every mode feeds the single ProgressState). */
export async function submitAnswer(
  sessionId: string,
  vocabularyItemId: string,
  correct: boolean,
): Promise<VocabularyItem> {
  const session = await practiceSessionModel.findById(sessionId);
  if (!session || session.mode !== 'training') {
    throw new TrainingError('Training session not found');
  }
  const item = await vocabularyModel.findById(vocabularyItemId);
  if (!item || item.learnerLanguageId !== session.learnerLanguageId) {
    throw new TrainingError('Vocabulary item not found for this session');
  }

  const updated = await applyAnswer(item, correct);

  const summary = (session.outcomeSummary as { correct?: number; incorrect?: number } | null) ?? {};
  await practiceSessionModel.recordOutcome(sessionId, {
    correct: (summary.correct ?? 0) + (correct ? 1 : 0),
    incorrect: (summary.incorrect ?? 0) + (correct ? 0 : 1),
  });

  await recordActivity(session.learnerLanguageId, correct ? POINTS_CORRECT : POINTS_INCORRECT);

  return updated;
}
