import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface VocabularyItem {
  id: string;
  masteryState: string;
}

describe('offline sync contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('replays a queued training answer exactly once, even if sent twice', async () => {
    const { cookie } = await registerAndLogin();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };
    const word = await json<VocabularyItem>(
      app.request('/api/languages/fr/vocabulary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ term: 'lait', translation: 'milk' }),
      }),
    );
    const { sessionId } = await json<{ sessionId: string }>(
      app.request('/api/languages/fr/training/session', { method: 'POST', headers: { Cookie: cookie } }),
    );

    const idempotencyKey = 'test-key-1';
    const syncBody = JSON.stringify({
      idempotencyKey,
      type: 'training-answer',
      payload: { sessionId, vocabularyItemId: word.id, correct: true },
    });

    const first = await app.request('/api/sync/actions', { method: 'POST', headers, body: syncBody });
    expect(first.status).toBe(200);
    expect((await first.json()) as { applied: boolean }).toEqual({ applied: true });

    // Replaying the same idempotencyKey must not double-apply the mastery advance.
    const second = await app.request('/api/sync/actions', { method: 'POST', headers, body: syncBody });
    expect(second.status).toBe(200);
    expect((await second.json()) as { applied: boolean }).toEqual({ applied: true });

    const list = await json<VocabularyItem[]>(app.request('/api/languages/fr/vocabulary', { headers: { Cookie: cookie } }));
    expect(list[0]?.masteryState).toBe('learning'); // one advance, not two
  });

  it('rejects an unknown action type', async () => {
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/sync/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ idempotencyKey: 'k2', type: 'not-a-real-type', payload: {} }),
    });
    expect(res.status).toBe(400);
  });
});
