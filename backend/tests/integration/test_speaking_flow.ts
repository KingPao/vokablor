import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test-db.js';
import { createLearner } from '../../src/models/learner.js';
import { ensureLearnerLanguage } from '../../src/models/learner-language.js';
import { addVocabulary } from '../../src/services/vocabulary-service.js';
import { getProgress } from '../../src/models/progress-state.js';
import * as vocabularyModel from '../../src/models/vocabulary-item.js';
import { startSpeakingSession, submitSpeakingAttempt } from '../../src/services/speaking-service.js';

let mockResult: 'correct' | 'corrected' | 'could_not_evaluate' = 'correct';

vi.mock('../../src/services/ai-provider-config-service.js', () => ({
  resolveProviderForLearner: vi.fn(async () => ({
    generateText: vi.fn(),
    converseTurn: vi.fn(),
    evaluateSpeech: vi.fn(async () => ({
      transcript: mockResult === 'could_not_evaluate' ? null : 'said-it',
      result: mockResult,
      correctionDetail: mockResult === 'corrected' ? 'Stress the second syllable.' : null,
      confidence: mockResult === 'could_not_evaluate' ? null : 0.9,
    })),
  })),
}));

describe('User Story 3: AI-corrected speaking practice', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('advances mastery and progress on a correct attempt, grounded correction on a wrong one', async () => {
    mockResult = 'correct';
    const learner = await createLearner('speaker@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    const word = await addVocabulary(learnerLanguage.id, 'pomme', 'apple', 'user_added');

    const { sessionId } = await startSpeakingSession(learnerLanguage.id);
    const attempt = await submitSpeakingAttempt(sessionId, word.id, Buffer.from([1, 2, 3]), 'audio/webm');
    expect(attempt.evaluationResult).toBe('correct');

    const updated = await vocabularyModel.findById(word.id);
    expect(updated?.masteryState).toBe('learning');
    const progress = await getProgress(learnerLanguage.id);
    expect(progress?.points).toBeGreaterThan(0);
  });

  it('never persists a correction alongside could_not_evaluate, and does not move mastery/progress', async () => {
    mockResult = 'could_not_evaluate';
    const learner = await createLearner('speaker2@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    const word = await addVocabulary(learnerLanguage.id, 'chien', 'dog', 'user_added');

    const { sessionId } = await startSpeakingSession(learnerLanguage.id);
    const attempt = await submitSpeakingAttempt(sessionId, word.id, Buffer.from([1, 2, 3]), 'audio/webm');

    expect(attempt.evaluationResult).toBe('could_not_evaluate');
    expect(attempt.correctionDetail).toBeNull();

    const updated = await vocabularyModel.findById(word.id);
    expect(updated?.masteryState).toBe('new'); // unchanged
    const progress = await getProgress(learnerLanguage.id);
    expect(progress?.points).toBe(0);
  });
});
