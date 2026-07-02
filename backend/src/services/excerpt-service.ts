import type { ProficiencyLevel } from '../db/schema.js';
import * as sourceExcerptModel from '../models/source-excerpt.js';
import type { SourceExcerpt } from '../models/source-excerpt.js';
import { ingestFeedForTerm } from './rss-ingest-service.js';

const LEVEL_ORDER: ProficiencyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function levelsAtOrBelow(level: ProficiencyLevel): ProficiencyLevel[] {
  const index = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER.slice(0, index + 1);
}

function configuredFeeds(languageCode: string): string[] {
  const raw = process.env[`RSS_FEEDS_${languageCode.toUpperCase()}`];
  return raw ? raw.split(',').map((url) => url.trim()).filter(Boolean) : [];
}

export interface ExcerptSearchResult {
  found: boolean;
  excerpts: SourceExcerpt[];
}

/**
 * FR-008/FR-010: excerpts at or below the learner's level containing the target word.
 * Checks the already-indexed excerpts first; if nothing qualifies, makes one best-effort
 * live RSS pass (research.md #7) before reporting an honest no-match rather than
 * substituting an unrelated or higher-level result.
 */
export async function findExcerptsForVocabulary(
  vocabularyItemId: string,
  term: string,
  languageCode: string,
  learnerLevel: ProficiencyLevel,
): Promise<ExcerptSearchResult> {
  const acceptableLevels = levelsAtOrBelow(learnerLevel);
  const existing = await sourceExcerptModel.findMatchesAtOrBelowLevel(vocabularyItemId, acceptableLevels);
  if (existing.length > 0) {
    return { found: true, excerpts: existing };
  }

  const feeds = configuredFeeds(languageCode);
  for (const feedUrl of feeds) {
    try {
      await ingestFeedForTerm(feedUrl, languageCode, learnerLevel, vocabularyItemId, term);
    } catch {
      // One feed being unreachable shouldn't fail the whole search; try the rest.
    }
  }

  const afterIngest = await sourceExcerptModel.findMatchesAtOrBelowLevel(vocabularyItemId, acceptableLevels);
  return { found: afterIngest.length > 0, excerpts: afterIngest };
}
