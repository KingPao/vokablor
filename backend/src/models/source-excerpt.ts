import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import type { ProficiencyLevel, SourceType } from '../db/schema.js';

export interface SourceExcerpt {
  id: string;
  languageCode: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  snippetText: string;
  level: ProficiencyLevel;
  fetchedAt: Date;
}

function toSourceExcerpt(row: {
  id: string;
  language_code: string;
  source_type: SourceType;
  source_name: string;
  source_url: string;
  snippet_text: string;
  level: ProficiencyLevel;
  fetched_at: Date;
}): SourceExcerpt {
  return {
    id: row.id,
    languageCode: row.language_code,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    snippetText: row.snippet_text,
    level: row.level,
    fetchedAt: row.fetched_at,
  };
}

export async function findExisting(languageCode: string, sourceUrl: string, snippetText: string): Promise<SourceExcerpt | null> {
  const row = await db
    .selectFrom('source_excerpts')
    .selectAll()
    .where('language_code', '=', languageCode)
    .where('source_url', '=', sourceUrl)
    .where('snippet_text', '=', snippetText)
    .executeTakeFirst();
  return row ? toSourceExcerpt(row) : null;
}

export async function create(excerpt: Omit<SourceExcerpt, 'id' | 'fetchedAt'>): Promise<SourceExcerpt> {
  const id = randomUUID();
  await db
    .insertInto('source_excerpts')
    .values({
      id,
      language_code: excerpt.languageCode,
      source_type: excerpt.sourceType,
      source_name: excerpt.sourceName,
      source_url: excerpt.sourceUrl,
      snippet_text: excerpt.snippetText,
      level: excerpt.level,
    })
    .execute();
  const row = await db.selectFrom('source_excerpts').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  return toSourceExcerpt(row);
}

/** research.md #7: excerpts are language-scoped and reusable across learners (Edge Cases: shared, not re-fetched per learner). */
export async function indexExcerpt(excerpt: Omit<SourceExcerpt, 'id' | 'fetchedAt'>): Promise<SourceExcerpt> {
  const existing = await findExisting(excerpt.languageCode, excerpt.sourceUrl, excerpt.snippetText);
  return existing ?? create(excerpt);
}

export async function linkToVocabulary(vocabularyItemId: string, sourceExcerptId: string): Promise<void> {
  await db
    .insertInto('vocabulary_excerpt_matches')
    .values({ vocabulary_item_id: vocabularyItemId, source_excerpt_id: sourceExcerptId })
    .onDuplicateKeyUpdate({ vocabulary_item_id: vocabularyItemId })
    .execute();
}

/** FR-008/FR-010: excerpts containing the term, filtered to at/below the learner's level. */
export async function findMatchesAtOrBelowLevel(
  vocabularyItemId: string,
  levelsAtOrBelow: ProficiencyLevel[],
): Promise<SourceExcerpt[]> {
  const rows = await db
    .selectFrom('source_excerpts')
    .innerJoin('vocabulary_excerpt_matches', 'vocabulary_excerpt_matches.source_excerpt_id', 'source_excerpts.id')
    .selectAll('source_excerpts')
    .where('vocabulary_excerpt_matches.vocabulary_item_id', '=', vocabularyItemId)
    .where('source_excerpts.level', 'in', levelsAtOrBelow)
    .execute();
  return rows.map(toSourceExcerpt);
}

/** Candidate excerpts for a language that mention `term` in their snippet, not yet linked to any word. */
export async function findUnlinkedCandidatesContaining(languageCode: string, term: string): Promise<SourceExcerpt[]> {
  const rows = await db
    .selectFrom('source_excerpts')
    .selectAll()
    .where('language_code', '=', languageCode)
    .where('snippet_text', 'like', `%${term}%`)
    .execute();
  return rows.map(toSourceExcerpt);
}
