import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import type { PracticeMode } from '../db/schema.js';

export interface PracticeSession {
  id: string;
  learnerLanguageId: string;
  mode: PracticeMode;
  startedAt: Date;
  endedAt: Date | null;
  outcomeSummary: Record<string, unknown> | null;
}

function toPracticeSession(row: {
  id: string;
  learner_language_id: string;
  mode: PracticeMode;
  started_at: Date;
  ended_at: Date | null;
  outcome_summary: Record<string, unknown> | null;
}): PracticeSession {
  return {
    id: row.id,
    learnerLanguageId: row.learner_language_id,
    mode: row.mode,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    outcomeSummary: row.outcome_summary,
  };
}

export async function findById(id: string): Promise<PracticeSession | null> {
  const row = await db.selectFrom('practice_sessions').selectAll().where('id', '=', id).executeTakeFirst();
  return row ? toPracticeSession(row) : null;
}

export async function start(learnerLanguageId: string, mode: PracticeMode): Promise<PracticeSession> {
  const id = randomUUID();
  await db.insertInto('practice_sessions').values({ id, learner_language_id: learnerLanguageId, mode }).execute();
  const created = await findById(id);
  if (!created) throw new Error('Failed to start practice session');
  return created;
}

export async function recordOutcome(id: string, outcomeSummary: Record<string, unknown>): Promise<void> {
  await db
    .updateTable('practice_sessions')
    .set({ outcome_summary: JSON.stringify(outcomeSummary) })
    .where('id', '=', id)
    .execute();
}

export async function end(id: string): Promise<void> {
  await db.updateTable('practice_sessions').set({ ended_at: new Date() }).where('id', '=', id).execute();
}

/** Sums training-mode answer outcomes since `since` — one input signal for LevelingService. */
export async function sumTrainingOutcomesSince(
  learnerLanguageId: string,
  since: Date,
): Promise<{ correct: number; incorrect: number }> {
  const rows = await db
    .selectFrom('practice_sessions')
    .select('outcome_summary')
    .where('learner_language_id', '=', learnerLanguageId)
    .where('mode', '=', 'training')
    .where('started_at', '>=', since)
    .execute();

  let correct = 0;
  let incorrect = 0;
  for (const row of rows) {
    const summary = row.outcome_summary as { correct?: number; incorrect?: number } | null;
    correct += summary?.correct ?? 0;
    incorrect += summary?.incorrect ?? 0;
  }
  return { correct, incorrect };
}
