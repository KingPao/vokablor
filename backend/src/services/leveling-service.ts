import type { ProficiencyLevel } from '../db/schema.js';
import { findLearnerLanguageById, updateLevel } from '../models/learner-language.js';
import { sumTrainingOutcomesSince } from '../models/practice-session.js';
import { countEvaluatedSince } from '../models/speaking-attempt.js';
import { countAiTurnsSince } from '../models/conversation.js';

const LEVEL_ORDER: ProficiencyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MIN_SAMPLES = 10;
const SUCCESS_THRESHOLD = 0.8;

export interface LevelReassessment {
  learnerLanguageId: string;
  previousLevel: ProficiencyLevel;
  newLevel: ProficiencyLevel;
  sampleSize: number;
  successRate: number | null;
}

/**
 * FR-018: recomputes a learner's level from observed performance across every mode since
 * their level last changed, rather than trusting a one-time self-report. Only ever advances
 * — struggling learners keep their current level and get reinforcement, they are never
 * silently downgraded by this job (spec.md US5 acceptance scenario 3).
 */
export async function reassessLevel(learnerLanguageId: string): Promise<LevelReassessment> {
  const learnerLanguage = await findLearnerLanguageById(learnerLanguageId);
  if (!learnerLanguage) throw new Error('Learner language not found');

  const since = learnerLanguage.levelUpdatedAt;
  const [training, speaking, conversation] = await Promise.all([
    sumTrainingOutcomesSince(learnerLanguageId, since),
    countEvaluatedSince(learnerLanguageId, since),
    countAiTurnsSince(learnerLanguageId, since),
  ]);

  const successCount = training.correct + speaking.correct + conversation.clean;
  const totalCount = successCount + training.incorrect + speaking.corrected + conversation.corrected;
  const successRate = totalCount > 0 ? successCount / totalCount : null;

  const currentIndex = LEVEL_ORDER.indexOf(learnerLanguage.currentLevel);
  const canAdvance = currentIndex < LEVEL_ORDER.length - 1;
  const shouldAdvance = canAdvance && totalCount >= MIN_SAMPLES && (successRate ?? 0) >= SUCCESS_THRESHOLD;

  const newLevel = shouldAdvance ? (LEVEL_ORDER[currentIndex + 1] as ProficiencyLevel) : learnerLanguage.currentLevel;

  if (shouldAdvance) {
    await updateLevel(learnerLanguageId, newLevel);
  }

  return {
    learnerLanguageId,
    previousLevel: learnerLanguage.currentLevel,
    newLevel,
    sampleSize: totalCount,
    successRate,
  };
}
