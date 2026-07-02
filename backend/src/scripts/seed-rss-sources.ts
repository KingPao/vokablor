/**
 * research.md #7: RSS feeds are configured via `RSS_FEEDS_<LANG>` env vars (read by
 * src/services/excerpt-service.ts), not a database table — there's no domain entity for
 * "known feed sources" in data-model.md, so "seeding" here means printing a starter list of
 * real, publicly syndicated feeds an operator can paste into their .env, not writing rows.
 *
 * Run: `npm run seed:rss` (prints suggestions) or `npm run seed:rss -- --verify` (also does a
 * best-effort HEAD-equivalent fetch of each feed to flag any that are currently unreachable).
 */

interface StarterFeed {
  languageCode: string;
  url: string;
  label: string;
}

const STARTER_FEEDS: StarterFeed[] = [
  { languageCode: 'FR', url: 'https://www.lemonde.fr/rss/une.xml', label: 'Le Monde — Une' },
  { languageCode: 'FR', url: 'https://www.france24.com/fr/rss', label: 'France 24 (FR)' },
  { languageCode: 'DE', url: 'https://www.tagesschau.de/xml/rss2/', label: 'Tagesschau' },
  { languageCode: 'ES', url: 'https://feeds.bbci.co.uk/mundo/rss.xml', label: 'BBC Mundo' },
];

function groupByLanguage(feeds: StarterFeed[]): Map<string, StarterFeed[]> {
  const grouped = new Map<string, StarterFeed[]>();
  for (const feed of feeds) {
    const existing = grouped.get(feed.languageCode) ?? [];
    existing.push(feed);
    grouped.set(feed.languageCode, existing);
  }
  return grouped;
}

async function verifyFeed(feed: StarterFeed): Promise<boolean> {
  try {
    const response = await fetch(feed.url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const shouldVerify = process.argv.includes('--verify');
  const grouped = groupByLanguage(STARTER_FEEDS);

  console.log('Suggested .env lines (research.md #7 — paste into your .env, comma-join more feeds per language):\n');

  for (const [languageCode, feeds] of grouped) {
    if (shouldVerify) {
      const results = await Promise.all(
        feeds.map(async (feed) => ({ feed, ok: await verifyFeed(feed) })),
      );
      for (const { feed, ok } of results) {
        console.log(`  ${ok ? '✔' : '✘ (unreachable right now)'} ${feed.label} — ${feed.url}`);
      }
    } else {
      for (const feed of feeds) {
        console.log(`  ${feed.label} — ${feed.url}`);
      }
    }
    console.log(`RSS_FEEDS_${languageCode}=${feeds.map((f) => f.url).join(',')}\n`);
  }
}

main();
