import { XMLParser } from 'fast-xml-parser';
import type { ProficiencyLevel } from '../db/schema.js';
import { indexExcerpt, linkToVocabulary } from '../models/source-excerpt.js';

const parser = new XMLParser({ ignoreAttributes: false });

interface FeedItem {
  title: string;
  link: string;
  sourceName: string;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function truncateToSnippet(text: string, maxLength = 280): string {
  const clean = stripHtml(text);
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

/**
 * research.md #7: only the headline/summary the publisher already syndicates via RSS is
 * ever read here — never the linked article body — so excerpt-only storage (Content
 * Sourcing & Compliance) is structural, not a downstream filtering step.
 */
export async function fetchFeedItems(feedUrl: string): Promise<FeedItem[]> {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed ${feedUrl}: ${response.status}`);
  }
  const xml = await response.text();
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { title?: string; item?: unknown | unknown[] } };
  };
  const channel = parsed.rss?.channel;
  if (!channel) return [];

  const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  const sourceName = typeof channel.title === 'string' ? channel.title : feedUrl;

  return items
    .filter((item): item is { title?: string; link?: string; description?: string } => typeof item === 'object')
    .map((item) => ({
      title: truncateToSnippet(String(item.title ?? item.description ?? '')),
      link: String(item.link ?? feedUrl),
      sourceName,
    }))
    .filter((item) => item.title.length > 0);
}

/**
 * Indexes every headline from a feed and links any that mention `term` to that vocabulary
 * item (FR-008). `level` is the level this feed/source is curated for (see
 * src/scripts/seed-rss-sources.ts) — excerpts are stored at that level, not re-graded here.
 */
export async function ingestFeedForTerm(
  feedUrl: string,
  languageCode: string,
  level: ProficiencyLevel,
  vocabularyItemId: string,
  term: string,
): Promise<number> {
  const items = await fetchFeedItems(feedUrl);
  let matched = 0;

  for (const item of items) {
    if (!item.title.toLowerCase().includes(term.toLowerCase())) continue;
    const excerpt = await indexExcerpt({
      languageCode,
      sourceType: 'news',
      sourceName: item.sourceName,
      sourceUrl: item.link,
      snippetText: item.title,
      level,
    });
    await linkToVocabulary(vocabularyItemId, excerpt.id);
    matched += 1;
  }

  return matched;
}
