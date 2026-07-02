import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test-db.js';
import { createLearner } from '../../src/models/learner.js';
import { ensureLearnerLanguage } from '../../src/models/learner-language.js';
import { getProgress } from '../../src/models/progress-state.js';
import { adoptFlaggedVocabulary, postTurn, startConversationSession } from '../../src/services/conversation-service.js';

vi.mock('../../src/services/ai-provider-config-service.js', () => ({
  resolveProviderForLearner: vi.fn(async () => ({
    generateText: vi.fn(async () => 'apple'),
    evaluateSpeech: vi.fn(),
    converseTurn: vi.fn(async ({ learnerMessage }: { learnerMessage: string }) => ({
      reply: `Je pense que tu voulais dire "je vais bien", pas "${learnerMessage}".`,
      flaggedNewVocabulary: ['pomme'],
      correctionDetail: 'Use "je vais bien" instead of the learner\'s phrasing.',
    })),
  })),
}));

describe('User Story 4: AI conversation practice', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('grounds corrections in the learner turn, flags new vocabulary, and lets it be adopted', async () => {
    const learner = await createLearner('convo@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');

    const { sessionId } = await startConversationSession(learnerLanguage.id);
    const aiTurn = await postTurn(sessionId, 'je bien');

    expect(aiTurn.speaker).toBe('ai');
    expect(aiTurn.correctionDetail).toContain('je vais bien');
    expect(aiTurn.flaggedNewVocabulary).toEqual(['pomme']);

    const progress = await getProgress(learnerLanguage.id);
    expect(progress?.points).toBeGreaterThan(0);

    const adopted = await adoptFlaggedVocabulary(aiTurn.id, 'pomme');
    expect(adopted.term).toBe('pomme');
    expect(adopted.origin).toBe('app_discovered');
    expect(adopted.translation).toBe('apple');
  });
});
