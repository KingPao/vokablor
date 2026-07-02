import * as practiceSessionModel from '../models/practice-session.js';
import * as vocabularyModel from '../models/vocabulary-item.js';
import * as speakingAttemptModel from '../models/speaking-attempt.js';
import { findLearnerLanguageById } from '../models/learner-language.js';
import { applyAnswer } from './vocabulary-service.js';
import { recordActivity } from '../models/progress-state.js';
import { resolveProviderForLearner } from './ai-provider-config-service.js';
import { storeAudio } from './audio-storage.js';
import type { VocabularyItem } from '../models/vocabulary-item.js';
import type { SpeakingAttempt } from '../models/speaking-attempt.js';
import type { SpeakingEvaluationResult } from '../db/schema.js';

export class SpeakingError extends Error {}

const POINTS_CORRECT = 10;
const POINTS_ATTEMPTED = 2;

export async function startSpeakingSession(
  learnerLanguageId: string,
): Promise<{ sessionId: string; nextItem: VocabularyItem | null }> {
  const session = await practiceSessionModel.start(learnerLanguageId, 'speaking');
  const due = await vocabularyModel.list(learnerLanguageId, { dueOnly: true });
  return { sessionId: session.id, nextItem: due[0] ?? null };
}

/** FR-011/FR-012: grounded correction or an explicit could_not_evaluate — never a guess. */
export async function submitSpeakingAttempt(
  sessionId: string,
  vocabularyItemId: string,
  audio: Buffer,
  mimeType: string,
): Promise<SpeakingAttempt> {
  const session = await practiceSessionModel.findById(sessionId);
  if (!session || session.mode !== 'speaking') {
    throw new SpeakingError('Speaking session not found');
  }
  const item = await vocabularyModel.findById(vocabularyItemId);
  if (!item || item.learnerLanguageId !== session.learnerLanguageId) {
    throw new SpeakingError('Vocabulary item not found for this session');
  }
  const learnerLanguage = await findLearnerLanguageById(session.learnerLanguageId);
  if (!learnerLanguage) throw new SpeakingError('Learner language not found');

  const provider = await resolveProviderForLearner(learnerLanguage.aiProviderId);
  const rawEvaluation = await provider.evaluateSpeech({
    audio,
    mimeType,
    targetTerm: item.term,
    targetTranslation: item.translation,
    context: { languageCode: learnerLanguage.languageCode, level: learnerLanguage.currentLevel },
  });
  // Defensive: a misbehaving provider adapter returning a malformed result must degrade to
  // "could not evaluate" rather than have an unrecognized value silently treated as success
  // (Principle III) or corrupt the NOT NULL evaluation_result column.
  const validResults: SpeakingEvaluationResult[] = ['correct', 'corrected', 'could_not_evaluate'];
  const evaluation = validResults.includes(rawEvaluation.result)
    ? rawEvaluation
    : { transcript: rawEvaluation.transcript, result: 'could_not_evaluate' as const, correctionDetail: null, confidence: null };

  const audioRef = await storeAudio(audio, mimeType);
  const attempt = await speakingAttemptModel.create({
    practiceSessionId: sessionId,
    vocabularyItemId,
    audioRef,
    transcript: evaluation.transcript,
    evaluationResult: evaluation.result,
    correctionDetail: evaluation.correctionDetail,
    confidence: evaluation.confidence,
  });

  if (evaluation.result !== 'could_not_evaluate') {
    await applyAnswer(item, evaluation.result === 'correct');
    await recordActivity(session.learnerLanguageId, evaluation.result === 'correct' ? POINTS_CORRECT : POINTS_ATTEMPTED);
  }

  return attempt;
}
