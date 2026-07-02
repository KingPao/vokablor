import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

vi.mock('../../src/services/vocabulary-suggestion-service.js', () => ({
  suggestVocabulary: vi.fn(async () => [
    { term: 'bonjour', translation: 'hello', level: 'A1', dictionaryVerified: true },
  ]),
}));

interface VocabularyItem {
  id: string;
  term: string;
  translation: string;
  origin: 'user_added' | 'app_discovered';
  masteryState: string;
}

describe('vocabulary contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('adds a vocabulary item manually', async () => {
    const { cookie } = await registerAndLogin();
    const res = app.request('/api/languages/fr/vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ term: 'chat', translation: 'cat' }),
    });
    expect((await res).status).toBe(201);
    const body = await json<VocabularyItem>(res);
    expect(body.origin).toBe('user_added');
    expect(body.masteryState).toBe('new');
  });

  it('reuses an existing entry instead of creating a duplicate', async () => {
    const { cookie } = await registerAndLogin();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };
    const first = await json<VocabularyItem>(
      app.request('/api/languages/fr/vocabulary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ term: 'chien', translation: 'dog' }),
      }),
    );
    const second = await json<VocabularyItem>(
      app.request('/api/languages/fr/vocabulary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ term: 'chien', translation: 'dog (again)' }),
      }),
    );
    expect(second.id).toBe(first.id);
    expect(second.translation).toBe('dog'); // original wins; not overwritten by the "duplicate"

    const items = await json<VocabularyItem[]>(app.request('/api/languages/fr/vocabulary', { headers: { Cookie: cookie } }));
    expect(items).toHaveLength(1);
  });

  it('lists vocabulary, edits, and deletes it', async () => {
    const { cookie } = await registerAndLogin();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };
    const created = await json<VocabularyItem>(
      app.request('/api/languages/fr/vocabulary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ term: 'maison', translation: 'house' }),
      }),
    );

    const editedRes = app.request(`/api/vocabulary/${created.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ translation: 'home' }),
    });
    expect((await editedRes).status).toBe(200);
    expect((await json<VocabularyItem>(editedRes)).translation).toBe('home');

    const deleted = await app.request(`/api/vocabulary/${created.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
    expect(deleted.status).toBe(204);

    const list = await json<VocabularyItem[]>(app.request('/api/languages/fr/vocabulary', { headers: { Cookie: cookie } }));
    expect(list).toHaveLength(0);
  });

  it('returns AI-generated, dictionary-checked suggestions without persisting them', async () => {
    const { cookie } = await registerAndLogin();
    const res = app.request('/api/languages/fr/vocabulary/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ topic: 'food' }),
    });
    expect((await res).status).toBe(200);
    const suggestions = await json(res);
    expect(suggestions).toEqual([{ term: 'bonjour', translation: 'hello', level: 'A1', dictionaryVerified: true }]);

    const list = await json<VocabularyItem[]>(app.request('/api/languages/fr/vocabulary', { headers: { Cookie: cookie } }));
    expect(list).toHaveLength(0);
  });

  it('adopts a suggested candidate as app_discovered', async () => {
    const { cookie } = await registerAndLogin();
    const res = app.request('/api/languages/fr/vocabulary/adopt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ term: 'bonjour', translation: 'hello' }),
    });
    expect((await res).status).toBe(201);
    expect((await json<VocabularyItem>(res)).origin).toBe('app_discovered');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.request('/api/languages/fr/vocabulary');
    expect(res.status).toBe(401);
  });
});
