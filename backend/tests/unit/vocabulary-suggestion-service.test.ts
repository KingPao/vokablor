import { describe, expect, it } from 'vitest';
import { suggestVocabulary } from '../../src/services/vocabulary-suggestion-service.js';
import { WiktionaryVerifier } from '../../src/services/dictionary-verifier.js';
import type { AIProvider } from '../../src/services/ai-providers/index.js';

function fakeProvider(rawText: string): AIProvider {
  return {
    generateText: async () => rawText,
    converseTurn: async () => ({ reply: '', flaggedNewVocabulary: [], correctionDetail: null }),
    evaluateSpeech: async () => ({ transcript: null, result: 'could_not_evaluate', correctionDetail: null, confidence: null }),
  };
}

describe('vocabulary suggestion service', () => {
  it('verifies each AI-generated candidate independently rather than trusting it blindly', async () => {
    const provider = fakeProvider(JSON.stringify([{ term: 'chat', translation: 'cat' }]));
    const suggestions = await suggestVocabulary('fr', 'A1', undefined, provider, {
      isKnownWord: async (term) => term === 'chat',
    });
    expect(suggestions).toEqual([{ term: 'chat', translation: 'cat', level: 'A1', dictionaryVerified: true }]);
  });

  it('surfaces unverified candidates rather than hiding them', async () => {
    const provider = fakeProvider(JSON.stringify([{ term: 'zorblax', translation: 'nonsense' }]));
    const suggestions = await suggestVocabulary('fr', 'A1', 'food', provider, { isKnownWord: async () => false });
    expect(suggestions).toEqual([{ term: 'zorblax', translation: 'nonsense', level: 'A1', dictionaryVerified: false }]);
  });

  it('returns no suggestions rather than fabricating any when the model breaks the JSON contract', async () => {
    const provider = fakeProvider('not json at all');
    const suggestions = await suggestVocabulary('fr', 'A1', undefined, provider, { isKnownWord: async () => true });
    expect(suggestions).toEqual([]);
  });

  it('filters out malformed candidate entries', async () => {
    const provider = fakeProvider(JSON.stringify([{ term: 'chat' }, { term: 'chien', translation: 'dog' }]));
    const suggestions = await suggestVocabulary('fr', 'A1', undefined, provider, { isKnownWord: async () => true });
    expect(suggestions).toEqual([{ term: 'chien', translation: 'dog', level: 'A1', dictionaryVerified: true }]);
  });
});

describe('WiktionaryVerifier (live check against the real API)', () => {
  it('recognizes a well-known French word', async () => {
    const verifier = new WiktionaryVerifier();
    expect(await verifier.isKnownWord('bonjour', 'fr')).toBe(true);
  });

  it('reports false for a made-up, non-existent word', async () => {
    const verifier = new WiktionaryVerifier();
    expect(await verifier.isKnownWord('zzznonexistentwordzzz123', 'fr')).toBe(false);
  });
});
