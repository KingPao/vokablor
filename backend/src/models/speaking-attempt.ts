import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import type { SpeakingEvaluationResult } from '../db/schema.js';

export interface SpeakingAttempt {
  id: string;
  practiceSessionId: string;
  vocabularyItemId: string;
  audioRef: string;
  transcript: string | null;
  evaluationResult: SpeakingEvaluationResult;
  correctionDetail: string | null;
  confidence: number | null;
  createdAt: Date;
}

function toSpeakingAttempt(row: {
  id: string;
  practice_session_id: string;
  vocabulary_item_id: string;
  audio_ref: string;
  transcript: string | null;
  evaluation_result: SpeakingEvaluationResult;
  correction_detail: string | null;
  confidence: number | null;
  created_at: Date;
}): SpeakingAttempt {
  return {
    id: row.id,
    practiceSessionId: row.practice_session_id,
    vocabularyItemId: row.vocabulary_item_id,
    audioRef: row.audio_ref,
    transcript: row.transcript,
    evaluationResult: row.evaluation_result,
    correctionDetail: row.correction_detail,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

export interface CreateSpeakingAttemptInput {
  practiceSessionId: string;
  vocabularyItemId: string;
  audioRef: string;
  transcript: string | null;
  evaluationResult: SpeakingEvaluationResult;
  correctionDetail: string | null;
  confidence: number | null;
}

/**
 * Principle III / data-model.md: a low-confidence "could not evaluate" outcome must never
 * carry a correction_detail, and a real correction must never be silently dropped — enforced
 * here at the write boundary, not left to callers to remember.
 */
export async function create(input: CreateSpeakingAttemptInput): Promise<SpeakingAttempt> {
  const correctionDetail = input.evaluationResult === 'could_not_evaluate' ? null : input.correctionDetail;
  const id = randomUUID();
  await db
    .insertInto('speaking_attempts')
    .values({
      id,
      practice_session_id: input.practiceSessionId,
      vocabulary_item_id: input.vocabularyItemId,
      audio_ref: input.audioRef,
      transcript: input.transcript,
      evaluation_result: input.evaluationResult,
      correction_detail: correctionDetail,
      confidence: input.confidence,
    })
    .execute();
  const row = await db.selectFrom('speaking_attempts').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  return toSpeakingAttempt(row);
}

/** Counts evaluated (non-`could_not_evaluate`) attempts since `since` — a LevelingService input signal. */
export async function countEvaluatedSince(
  learnerLanguageId: string,
  since: Date,
): Promise<{ correct: number; corrected: number }> {
  const rows = await db
    .selectFrom('speaking_attempts')
    .innerJoin('practice_sessions', 'practice_sessions.id', 'speaking_attempts.practice_session_id')
    .select('speaking_attempts.evaluation_result')
    .where('practice_sessions.learner_language_id', '=', learnerLanguageId)
    .where('speaking_attempts.created_at', '>=', since)
    .where('speaking_attempts.evaluation_result', '!=', 'could_not_evaluate')
    .execute();

  let correct = 0;
  let corrected = 0;
  for (const row of rows) {
    if (row.evaluation_result === 'correct') correct += 1;
    else if (row.evaluation_result === 'corrected') corrected += 1;
  }
  return { correct, corrected };
}
