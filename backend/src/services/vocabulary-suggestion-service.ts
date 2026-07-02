import type { AIProvider } from './ai-providers/index.js';
import { getSharedFreeProvider } from './ai-providers/index.js';
import { WiktionaryVerifier, type DictionaryVerifier } from './dictionary-verifier.js';
import type { ProficiencyLevel } from '../db/schema.js';

export interface VocabularySuggestion {
  term: string;
  translation: string;
  level: ProficiencyLevel;
  dictionaryVerified: boolean;
}

/**
 * FR-002 / research.md #8: generates candidate vocabulary via the configured AIProvider,
 * then independently checks each candidate against a free dictionary rather than trusting
 * the AI's translation blindly. `dictionaryVerified: false` doesn't block a suggestion —
 * it's surfaced to the caller/UI as a lower-confidence signal.
 */
export async function suggestVocabulary(
  languageCode: string,
  level: ProficiencyLevel,
  topic: string | undefined,
  provider: AIProvider = getSharedFreeProvider(),
  verifier: DictionaryVerifier = new WiktionaryVerifier(),
): Promise<VocabularySuggestion[]> {
  const prompt = [
    `Suggest 8 vocabulary words or short phrases in ${languageCode} appropriate for a CEFR ${level} learner`,
    topic ? `on the topic of "${topic}".` : 'covering everyday, general-purpose vocabulary.',
    'Respond with strict JSON: an array of {"term": string, "translation": string}. No other text.',
  ].join(' ');

  const raw = await provider.generateText({ prompt, context: { languageCode, level } });

  let candidates: { term: string; translation: string }[];
  try {
    candidates = JSON.parse(raw);
    if (!Array.isArray(candidates)) throw new Error('not an array');
  } catch {
    // The model didn't return usable JSON — better to surface no suggestions than fabricate some.
    return [];
  }

  const results = await Promise.all(
    candidates
      .filter((c) => typeof c.term === 'string' && typeof c.translation === 'string')
      .map(async (c) => ({
        term: c.term,
        translation: c.translation,
        level,
        dictionaryVerified: await verifier.isKnownWord(c.term, languageCode),
      })),
  );

  return results;
}
