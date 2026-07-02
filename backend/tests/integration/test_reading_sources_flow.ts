import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test-db.js';
import { findExcerptsForVocabulary } from '../../src/services/excerpt-service.js';
import { addVocabulary } from '../../src/services/vocabulary-service.js';
import { ensureLearnerLanguage } from '../../src/models/learner-language.js';
import { createLearner } from '../../src/models/learner.js';

const FEED_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Le Fixture Journal</title>
    <item>
      <title>La pomme reste le fruit préféré des Français cette année</title>
      <link>https://example.test/articles/pomme</link>
    </item>
    <item>
      <title>Un article sans rapport avec le vocabulaire testé</title>
      <link>https://example.test/articles/unrelated</link>
    </item>
  </channel>
</rss>`;

describe('User Story 2: level-adaptive real-world reading', () => {
  let server: Server;
  let feedUrl: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end(FEED_XML);
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address && typeof address === 'object') {
      feedUrl = `http://127.0.0.1:${address.port}`;
    }
    process.env.RSS_FEEDS_FR = feedUrl;
  });

  afterAll(async () => {
    delete process.env.RSS_FEEDS_FR;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('indexes a matching headline as a level-tagged excerpt with attribution', async () => {
    const learner = await createLearner('reader@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    const word = await addVocabulary(learnerLanguage.id, 'pomme', 'apple', 'user_added');

    const result = await findExcerptsForVocabulary(word.id, word.term, 'fr', learnerLanguage.currentLevel);

    expect(result.found).toBe(true);
    expect(result.excerpts).toHaveLength(1);
    expect(result.excerpts[0]?.sourceUrl).toBe('https://example.test/articles/pomme');
    expect(result.excerpts[0]?.snippetText).toContain('pomme');
    expect(result.excerpts[0]?.level).toBe(learnerLanguage.currentLevel);
    // Never the full article body — only the syndicated headline (Content Sourcing & Compliance).
    expect(result.excerpts[0]?.snippetText.length).toBeLessThan(200);
  });

  it('reports an honest no-match for a word absent from every configured feed', async () => {
    const learner = await createLearner('reader2@example.com', 'hash');
    const learnerLanguage = await ensureLearnerLanguage(learner.id, 'fr');
    const word = await addVocabulary(learnerLanguage.id, 'zorblax', 'nonsense-word', 'user_added');

    const result = await findExcerptsForVocabulary(word.id, word.term, 'fr', learnerLanguage.currentLevel);

    expect(result.found).toBe(false);
    expect(result.excerpts).toHaveLength(0);
  });
});
