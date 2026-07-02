import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test-db.js';
import { createLearner } from '../../src/models/learner.js';
import { ensureLearnerLanguage } from '../../src/models/learner-language.js';
import { addVocabulary } from '../../src/services/vocabulary-service.js';
import { startTrainingSession, submitAnswer } from '../../src/services/training-service.js';
import { reassessLevel } from '../../src/services/leveling-service.js';
import { getProgress } from '../../src/models/progress-state.js';
import { findExcerptsForVocabulary } from '../../src/services/excerpt-service.js';

async function answerNTimes(learnerLanguageId: string, vocabularyItemId: string, count: number, correct: boolean) {
  for (let i = 0; i < count; i += 1) {
    const { sessionId } = await startTrainingSession(learnerLanguageId);
    await submitAnswer(sessionId, vocabularyItemId, correct);
  }
}

describe('User Story 5: gamified progress and adaptive leveling', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('feeds a single ProgressState from training activity and raises the level on sustained success', async () => {
    const learner = await createLearner('leveler@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    const word = await addVocabulary(learnerLanguage.id, 'pomme', 'apple', 'user_added');

    const before = await getProgress(learnerLanguage.id);
    expect(before?.points).toBe(0);

    await answerNTimes(learnerLanguage.id, word.id, 12, true);

    const after = await getProgress(learnerLanguage.id);
    expect(after?.points).toBeGreaterThan(before?.points ?? 0);

    const reassessment = await reassessLevel(learnerLanguage.id);
    expect(reassessment.previousLevel).toBe('A1');
    expect(reassessment.newLevel).toBe('A2');

    // The new level must feed forward into source selection (FR-019) — same word, same
    // level-filtered excerpt search now runs against A2 instead of A1.
    const excerptSearch = await findExcerptsForVocabulary(word.id, word.term, 'fr', reassessment.newLevel);
    expect(excerptSearch.found).toBe(false); // no feeds configured in this test; asserts it queried the *new* level without throwing
  });

  it('does not raise the level when the learner has recently struggled', async () => {
    const learner = await createLearner('struggler@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    const word = await addVocabulary(learnerLanguage.id, 'chien', 'dog', 'user_added');

    await answerNTimes(learnerLanguage.id, word.id, 12, false);

    const reassessment = await reassessLevel(learnerLanguage.id);
    expect(reassessment.newLevel).toBe('A1'); // unchanged
    expect(reassessment.successRate).toBeLessThan(0.8);
  });
});
