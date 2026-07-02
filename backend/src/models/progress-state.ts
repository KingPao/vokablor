import { db } from '../db/client.js';

export interface ProgressSnapshot {
  learnerLanguageId: string;
  points: number;
  currentStreakDays: number;
  lastActivityAt: Date | null;
}

function toSnapshot(row: {
  learner_language_id: string;
  points: number;
  current_streak_days: number;
  last_activity_at: Date | null;
}): ProgressSnapshot {
  return {
    learnerLanguageId: row.learner_language_id,
    points: row.points,
    currentStreakDays: row.current_streak_days,
    lastActivityAt: row.last_activity_at,
  };
}

export async function getProgress(learnerLanguageId: string): Promise<ProgressSnapshot | null> {
  const row = await db
    .selectFrom('progress_states')
    .selectAll()
    .where('learner_language_id', '=', learnerLanguageId)
    .executeTakeFirst();
  return row ? toSnapshot(row) : null;
}

function isConsecutiveDay(last: Date, now: Date): boolean {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diff = now.getTime() - last.getTime();
  return diff > 0 && diff <= oneDayMs * 2; // within the previous day's window, allowing for time-of-day drift
}

/**
 * FR-017: every completed PracticeSession, in every mode, funnels through this single
 * helper so points/streaks are one cross-mode representation rather than per-mode counters.
 * `pointsEarned` is mode-specific (caller decides how many points an action is worth); the
 * streak/points bookkeeping itself is mode-agnostic.
 */
export async function recordActivity(learnerLanguageId: string, pointsEarned: number): Promise<ProgressSnapshot> {
  const now = new Date();
  const existing = await db
    .selectFrom('progress_states')
    .selectAll()
    .where('learner_language_id', '=', learnerLanguageId)
    .executeTakeFirst();

  if (!existing) {
    await db
      .insertInto('progress_states')
      .values({
        learner_language_id: learnerLanguageId,
        points: pointsEarned,
        current_streak_days: 1,
        last_activity_at: now,
      })
      .execute();
    return { learnerLanguageId, points: pointsEarned, currentStreakDays: 1, lastActivityAt: now };
  }

  const sameDay = existing.last_activity_at !== null && existing.last_activity_at.toDateString() === now.toDateString();
  const streak = sameDay
    ? existing.current_streak_days
    : existing.last_activity_at && isConsecutiveDay(existing.last_activity_at, now)
      ? existing.current_streak_days + 1
      : 1;

  const points = existing.points + pointsEarned;

  await db
    .updateTable('progress_states')
    .set({ points, current_streak_days: streak, last_activity_at: now, updated_at: now })
    .where('learner_language_id', '=', learnerLanguageId)
    .execute();

  return { learnerLanguageId, points, currentStreakDays: streak, lastActivityAt: now };
}

export async function ensureProgressState(learnerLanguageId: string): Promise<void> {
  await db
    .insertInto('progress_states')
    .values({ learner_language_id: learnerLanguageId, points: 0, current_streak_days: 0, last_activity_at: null })
    .onDuplicateKeyUpdate({ learner_language_id: learnerLanguageId })
    .execute();
}
