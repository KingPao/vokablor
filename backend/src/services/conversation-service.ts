import * as practiceSessionModel from '../models/practice-session.js';
import * as conversationModel from '../models/conversation.js';
import * as vocabularyModel from '../models/vocabulary-item.js';
import { findLearnerLanguageById } from '../models/learner-language.js';
import { addVocabulary } from './vocabulary-service.js';
import { recordActivity } from '../models/progress-state.js';
import { resolveProviderForLearner } from './ai-provider-config-service.js';
import type { ConversationTurn } from '../models/conversation.js';
import type { VocabularyItem } from '../models/vocabulary-item.js';

export class ConversationError extends Error {}

const POINTS_PER_TURN = 5;

export async function startConversationSession(learnerLanguageId: string): Promise<{ sessionId: string }> {
  const practiceSession = await practiceSessionModel.start(learnerLanguageId, 'conversation');
  const conversationSession = await conversationModel.createSession(practiceSession.id);
  return { sessionId: conversationSession.id };
}

/** FR-013/FR-014: reply grounded in the actual exchange, scoped to known vocabulary/level, new words flagged. */
export async function postTurn(conversationSessionId: string, learnerMessage: string): Promise<ConversationTurn> {
  const conversationSession = await conversationModel.findSessionById(conversationSessionId);
  if (!conversationSession) throw new ConversationError('Conversation session not found');
  const practiceSession = await practiceSessionModel.findById(conversationSession.practiceSessionId);
  if (!practiceSession) throw new ConversationError('Conversation session not found');
  const learnerLanguage = await findLearnerLanguageById(practiceSession.learnerLanguageId);
  if (!learnerLanguage) throw new ConversationError('Learner language not found');

  const history = await conversationModel.listTurns(conversationSessionId);
  const knownVocabulary = (await vocabularyModel.list(learnerLanguage.id)).map((v) => v.term);
  const provider = await resolveProviderForLearner(learnerLanguage.aiProviderId);

  const result = await provider.converseTurn({
    history: history.map((t) => ({ speaker: t.speaker, content: t.content })),
    learnerMessage,
    knownVocabulary,
    context: { languageCode: learnerLanguage.languageCode, level: learnerLanguage.currentLevel },
  });

  await conversationModel.createTurn({
    conversationSessionId,
    speaker: 'learner',
    turnIndex: history.length,
    content: learnerMessage,
  });

  const aiTurn = await conversationModel.createTurn({
    conversationSessionId,
    speaker: 'ai',
    turnIndex: history.length + 1,
    content: result.reply,
    flaggedNewVocabulary: result.flaggedNewVocabulary,
    correctionDetail: result.correctionDetail,
  });

  await recordActivity(learnerLanguage.id, POINTS_PER_TURN);

  return aiTurn;
}

export async function endConversationSession(conversationSessionId: string): Promise<void> {
  const conversationSession = await conversationModel.findSessionById(conversationSessionId);
  if (!conversationSession) return;
  await practiceSessionModel.end(conversationSession.practiceSessionId);
}

/** FR-015: one-action adoption of AI-introduced vocabulary; translation is best-effort via the same provider. */
export async function adoptFlaggedVocabulary(turnId: string, term: string): Promise<VocabularyItem> {
  const turn = await conversationModel.findTurnById(turnId);
  if (!turn || !turn.flaggedNewVocabulary.includes(term)) {
    throw new ConversationError('That term was not flagged as new vocabulary on this turn');
  }
  const conversationSession = await conversationModel.findSessionById(turn.conversationSessionId);
  if (!conversationSession) throw new ConversationError('Conversation session not found');
  const practiceSession = await practiceSessionModel.findById(conversationSession.practiceSessionId);
  if (!practiceSession) throw new ConversationError('Conversation session not found');
  const learnerLanguage = await findLearnerLanguageById(practiceSession.learnerLanguageId);
  if (!learnerLanguage) throw new ConversationError('Learner language not found');

  const provider = await resolveProviderForLearner(learnerLanguage.aiProviderId);
  let translation = term;
  try {
    const raw = await provider.generateText({
      prompt: `Translate the ${learnerLanguage.languageCode} word or phrase "${term}" to English. Respond with only the translation, no other text.`,
      context: { languageCode: learnerLanguage.languageCode, level: learnerLanguage.currentLevel },
    });
    if (raw.trim()) translation = raw.trim();
  } catch {
    // Best-effort only — an unavailable translation shouldn't block adopting the word itself.
  }

  return addVocabulary(learnerLanguage.id, term, translation, 'app_discovered');
}
