import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface VocabularyItem {
  id: string;
  term: string;
  translation: string;
}

interface TrainingSession {
  sessionId: string;
  dueItems: VocabularyItem[];
}

async function addWord(cookie: string, term: string, translation: string): Promise<VocabularyItem> {
  return json<VocabularyItem>(
    app.request('/api/languages/fr/vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ term, translation }),
    }),
  );
}

describe('training contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('starts a session with due items and accepts an answer', async () => {
    const { cookie } = await registerAndLogin();
    const word = await addWord(cookie, 'pomme', 'apple');

    const sessionRes = app.request('/api/languages/fr/training/session', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect((await sessionRes).status).toBe(200);
    const { sessionId, dueItems } = await json<TrainingSession>(sessionRes);
    expect(dueItems.map((i) => i.id)).toContain(word.id);

    const answerRes = app.request(`/api/training/sessions/${sessionId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ vocabularyItemId: word.id, correct: true }),
    });
    expect((await answerRes).status).toBe(200);
    expect((await json<{ masteryState: string }>(answerRes)).masteryState).toBe('learning');
  });

  it('404s when answering for a session that does not exist', async () => {
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/training/sessions/nonexistent/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ vocabularyItemId: 'nonexistent', correct: true }),
    });
    expect(res.status).toBe(404);
  });
});
