/**
 * research.md #8: an independent, free/open check on AI-generated vocabulary candidates —
 * we don't want to just trust the AI's own translation. Wiktionary's REST API is free,
 * keyless, and covers a very wide range of languages.
 */
export interface DictionaryVerifier {
  isKnownWord(term: string, languageCode: string): Promise<boolean>;
}

const WIKTIONARY_BASE = 'https://en.wiktionary.org/api/rest_v1/page/definition';

export class WiktionaryVerifier implements DictionaryVerifier {
  async isKnownWord(term: string, languageCode: string): Promise<boolean> {
    try {
      const response = await fetch(`${WIKTIONARY_BASE}/${encodeURIComponent(term)}`);
      if (!response.ok) return false;
      const body = (await response.json()) as Record<string, unknown>;
      // Wiktionary keys definitions by ISO 639-1-style language code (e.g. "fr"), which
      // matches this app's own languageCode values directly — no name mapping needed.
      const primaryCode = languageCode.toLowerCase().split('-')[0];
      return Object.keys(body).some((key) => key.toLowerCase() === primaryCode);
    } catch {
      return false;
    }
  }
}
