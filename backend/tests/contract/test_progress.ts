import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface Progress {
  points: number;
  currentStreakDays: number;
  currentLevel: string;
}

describe('progress contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns zeroed progress and the starting level for a brand-new language', async () => {
    const { cookie } = await registerAndLogin();
    const progress = await json<Progress>(app.request('/api/languages/fr/progress', { headers: { Cookie: cookie } }));
    expect(progress.points).toBe(0);
    expect(progress.currentStreakDays).toBe(0);
    expect(progress.currentLevel).toBe('A1');
  });

  it('reflects points earned from a training answer', async () => {
    const { cookie } = await registerAndLogin();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };
    const word = await json<{ id: string }>(
      app.request('/api/languages/fr/vocabulary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ term: 'eau', translation: 'water' }),
      }),
    );
    const { sessionId } = await json<{ sessionId: string }>(
      app.request('/api/languages/fr/training/session', { method: 'POST', headers: { Cookie: cookie } }),
    );
    await app.request(`/api/training/sessions/${sessionId}/answers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ vocabularyItemId: word.id, correct: true }),
    });

    const progress = await json<Progress>(app.request('/api/languages/fr/progress', { headers: { Cookie: cookie } }));
    expect(progress.points).toBeGreaterThan(0);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.request('/api/languages/fr/progress');
    expect(res.status).toBe(401);
  });
});
