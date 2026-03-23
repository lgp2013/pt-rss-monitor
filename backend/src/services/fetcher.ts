import Parser from 'rss-parser';
import db from '../db.js';
import type { Source, Resource } from '../types.js';

const parser = new Parser({
  customFields: {
    item: [
      ['seeders', 'seeders'],
      ['seed', 'seed'],
      ['leechers', 'leechers'],
      ['leech', 'leech'],
      ['grabs', 'grabs'],
      ['downloads', 'downloads'],
      ['size', 'size'],
      ['free', 'free'],
    ],
  },
});

// Parse size from text
function parseSize(text: string): string | null {
  const match = text.match(/(\d+\.?\d*)\s*([GMKT]B?)/i);
  if (match) {
    return `${match[1]} ${match[2].toUpperCase()}`;
  }
  return null;
}

// Parse free tag from text
function parseFreeTag(text: string): string | null {
  if (/free|免费|0%|100%/i.test(text)) {
    return 'FREE';
  }
  const discountMatch = text.match(/(\d+)%/);
  if (discountMatch) {
    return `${discountMatch[1]}%`;
  }
  return null;
}

// Parse seeders from text
function parseSeeders(text: string): number {
  const match = text.match(/seeders?[:\s]+(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

// Parse leechers from text
function parseLeechers(text: string): number {
  const match = text.match(/leechers?[:\s]+(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

// Parse downloads from text
function parseDownloads(text: string): number {
  const match = text.match(/downloads?[:\s]+(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

// Extract info from item
function extractInfo(item: Record<string, any>): Partial<Resource> {
  const text = `${item.title || ''} ${item.description || ''} ${item.content || ''}`;
  
  return {
    size: parseSize(text),
    free_tag: parseFreeTag(text),
    seeders: parseSeeders(text),
    leechers: parseLeechers(text),
    downloads: parseDownloads(text),
  };
}

// Fetch RSS for a single source
export async function fetchSource(source: Source): Promise<number> {
  try {
    console.log(`Starting to fetch source: ${source.name} (${source.url})`);
    const feed = await parser.parseURL(source.url);
    console.log(`Fetched ${feed.items.length} items from ${source.name}`);
    let newCount = 0;

    const insertStmt = db.prepare(`
      INSERT INTO resources (source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const checkStmt = db.prepare(`
      SELECT id FROM resources WHERE source_id = ? AND (guid = ? OR link = ?)
    `);

    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        const existing = checkStmt.get(source.id, item.guid || item.link, item.link);
        if (!existing) {
          insertStmt.run(
            source.id,
            item.title || 'Untitled',
            item.link || '',
            item.guid || item.link || '',
            item.pubDate || null,
            item.seeders || 0,
            item.leechers || 0,
            item.downloads || 0,
            item.free_tag || null,
            item.size || null
          );
          newCount++;
        }
      }
    });

    const items = feed.items.map((item: any) => ({
      ...item,
      ...extractInfo(item),
    }));

    insertMany(items);

    // Update last fetch time (simulated, since in-memory DB doesn't have last_fetch field)
    console.log(`Updated last fetch time for source ${source.name}`);

    console.log(`Finished fetching source ${source.name}, added ${newCount} new resources`);
    return newCount;
  } catch (error) {
    console.error(`Failed to fetch source ${source.name}:`, error);
    return 0;
  }
}

// Fetch all enabled sources
export async function fetchAllSources(): Promise<void> {
  const sources = db.prepare('SELECT * FROM sources WHERE enabled = 1').all() as Source[];
  
  for (const source of sources) {
    await fetchSource(source);
  }
}

// Clean old resources
export function cleanOldResources(days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const result = db.prepare('DELETE FROM resources WHERE created_at < ?').run(cutoffStr);
  return result.changes;
}
