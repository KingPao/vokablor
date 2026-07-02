import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface VocabularyItem {
  id: string;
}

vi.mock('../../src/services/excerpt-service.js', () => ({
  findExcerptsForVocabulary: vi.fn(async (_vocabularyItemId: string, term: string) => {
    if (term === 'pomme') {
      return {
        found: true,
        excerpts: [
          {
            id: 'excerpt-1',
            languageCode: 'fr',
            sourceType: 'news',
            sourceName: 'Le Monde',
            sourceUrl: 'https://example.com/article',
            snippetText: 'La pomme est un fruit populaire en France.',
            level: 'A1',
            fetchedAt: new Date(),
          },
        ],
      };
    }
    return { found: false, excerpts: [] };
  }),
}));

async function addWord(cookie: string, term: string): Promise<VocabularyItem> {
  return json<VocabularyItem>(
    app.request('/api/languages/fr/vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ term, translation: term }),
    }),
  );
}

describe('excerpts contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns level-appropriate excerpts with attribution for a matched word', async () => {
    const { cookie } = await registerAndLogin();
    const word = await addWord(cookie, 'pomme');

    const res = await app.request(`/api/vocabulary/${word.id}/excerpts`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const excerpts = (await res.json()) as { sourceUrl: string; snippetText: string }[];
    expect(excerpts).toHaveLength(1);
    expect(excerpts[0]?.sourceUrl).toBe('https://example.com/article');
    expect(excerpts[0]?.snippetText.length).toBeLessThan(500);
  });

  it('returns an explicit no-match response rather than a mismatched result', async () => {
    const { cookie } = await registerAndLogin();
    const word = await addWord(cookie, 'zorblax');

    const res = await app.request(`/api/vocabulary/${word.id}/excerpts`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NO_LEVEL_APPROPRIATE_MATCH');
  });

  it('404s for a vocabulary item that does not belong to the caller', async () => {
    const { cookie: ownerCookie } = await registerAndLogin();
    const word = await addWord(ownerCookie, 'pomme');
    const { cookie: otherCookie } = await registerAndLogin();

    const res = await app.request(`/api/vocabulary/${word.id}/excerpts`, { headers: { Cookie: otherCookie } });
    expect(res.status).toBe(404);
  });

  it('404s for a vocabulary item id that does not exist at all', async () => {
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/vocabulary/nonexistent/excerpts', { headers: { Cookie: cookie } });
    expect(res.status).toBe(404);
  });
});
