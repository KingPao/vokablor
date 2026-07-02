import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test-db.js';
import { db } from '../../src/db/client.js';
import { createLearner } from '../../src/models/learner.js';
import { ensureLearnerLanguage } from '../../src/models/learner-language.js';
import { getProgress, recordActivity } from '../../src/models/progress-state.js';

async function backdateLastActivity(learnerLanguageId: string, when: Date): Promise<void> {
  await db
    .updateTable('progress_states')
    .set({ last_activity_at: when })
    .where('learner_language_id', '=', learnerLanguageId)
    .execute();
}

describe('progress state', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns null for a language with no recorded activity yet', async () => {
    const learner = await createLearner('noprogress@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    // ensureLearnerLanguage seeds a zeroed row, so delete it to test the genuinely-missing case.
    await db.deleteFrom('progress_states').where('learner_language_id', '=', learnerLanguage.id).execute();
    expect(await getProgress(learnerLanguage.id)).toBeNull();
  });

  it('keeps the streak unchanged on a second activity the same day', async () => {
    const learner = await createLearner('sameday@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    await recordActivity(learnerLanguage.id, 10);
    const second = await recordActivity(learnerLanguage.id, 5);
    expect(second.currentStreakDays).toBe(1);
    expect(second.points).toBe(15);
  });

  it('advances the streak when the previous activity was the day before', async () => {
    const learner = await createLearner('consecutive@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    await recordActivity(learnerLanguage.id, 10);
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000); // >24h ago, still "yesterday" window
    await backdateLastActivity(learnerLanguage.id, yesterday);

    const result = await recordActivity(learnerLanguage.id, 10);
    expect(result.currentStreakDays).toBe(2);
  });

  it('resets the streak to 1 after a multi-day gap', async () => {
    const learner = await createLearner('gap@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    await recordActivity(learnerLanguage.id, 10);
    const longAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await backdateLastActivity(learnerLanguage.id, longAgo);

    const result = await recordActivity(learnerLanguage.id, 10);
    expect(result.currentStreakDays).toBe(1);
  });
});
