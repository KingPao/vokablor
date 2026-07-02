import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface VocabularyItem {
  id: string;
  masteryState: string;
}

interface TrainingSession {
  sessionId: string;
}

describe('User Story 1: build and practice a personal vocabulary list', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('supports the full add -> train -> mastery-progression -> dedupe loop', async () => {
    const { cookie } = await registerAndLogin();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };

    const word = await json<VocabularyItem>(
      app.request('/api/languages/fr/vocabulary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ term: 'eau', translation: 'water' }),
      }),
    );
    expect(word.masteryState).toBe('new');

    // Re-adding the same term must reuse the row, not duplicate it (FR-005).
    const reAdded = await json<VocabularyItem>(
      app.request('/api/languages/fr/vocabulary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ term: 'eau', translation: 'water (duplicate attempt)' }),
      }),
    );
    expect(reAdded.id).toBe(word.id);

    const expectedProgression = ['learning', 'reviewing', 'mastered'];
    for (const expectedState of expectedProgression) {
      const { sessionId } = await json<TrainingSession>(
        app.request('/api/languages/fr/training/session', { method: 'POST', headers: { Cookie: cookie } }),
      );

      const result = await json<{ masteryState: string }>(
        app.request(`/api/training/sessions/${sessionId}/answers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ vocabularyItemId: word.id, correct: true }),
        }),
      );

      expect(result.masteryState).toBe(expectedState);
    }

    // A wrong answer retreats exactly one step (mastered -> reviewing), never straight to "new".
    const { sessionId: lastSessionId } = await json<TrainingSession>(
      app.request('/api/languages/fr/training/session', { method: 'POST', headers: { Cookie: cookie } }),
    );
    const afterMistake = await json<{ masteryState: string }>(
      app.request(`/api/training/sessions/${lastSessionId}/answers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ vocabularyItemId: word.id, correct: false }),
      }),
    );
    expect(afterMistake.masteryState).toBe('reviewing');

    const finalList = await json<VocabularyItem[]>(
      app.request('/api/languages/fr/vocabulary', { headers: { Cookie: cookie } }),
    );
    expect(finalList).toHaveLength(1);
  });
});
