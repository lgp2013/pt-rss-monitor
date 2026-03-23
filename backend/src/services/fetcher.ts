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

// Parse free tag from text - handles [免费] [50%] format
function parseFreeTag(text: string): string | null {
  // Check for [免费] or [FREE] format in brackets
  const bracketMatch = text.match(/\[(免费|FREE|\d+%|0%|100%)\]/i);
  if (bracketMatch) {
    const tag = bracketMatch[1].toUpperCase();
    if (tag === '免费' || tag === 'FREE' || tag === '0%' || tag === '100%') {
      return 'FREE';
    }
    return tag;
  }
  
  // Fallback to other patterns
  if (/free|免费|0%|100%/i.test(text)) {
    return 'FREE';
  }
  const discountMatch = text.match(/(\d+)%/);
  if (discountMatch) {
    return `${discountMatch[1]}%`;
  }
  return null;
}

// Extract clean title without free tag brackets
function extractCleanTitle(title: string): { title: string; freeTag: string | null } {
  // Remove [免费] [50%] etc from title
  const freeTagMatch = title.match(/\[(免费|FREE|\d+%|0%|100%)\]/i);
  let freeTag: string | null = null;
  let cleanTitle = title;
  
  if (freeTagMatch) {
    freeTag = parseFreeTag(title) || freeTagMatch[1];
    cleanTitle = title.replace(/\s*\[\s*(免费|FREE|\d+%|0%|100%)\s*\]\s*/gi, '').trim();
  }
  
  return { title: cleanTitle, freeTag };
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
  const title = item.title || '';
  const text = `${title} ${item.description || ''} ${item.content || ''}`;
  
  // Extract clean title and free tag
  const { title: cleanTitle, freeTag } = extractCleanTitle(title);
  
  // Extract subtitle from title - the part after the main title with resolution/format info
  // Example: "Movie.Name.2026.2160p.WEB-DL.H265.10bit.DDP5.1" -> "2160p WEB-DL H265 10bit DDP5.1"
  let subtitle = null;
  
  // Pattern: after year or resolution, extract format specs
  const subtitleMatch = title.match(/\.((?:2160p|1080p|720p|480p)(?:\.[A-Z0-9]+)+)/i);
  if (subtitleMatch) {
    subtitle = subtitleMatch[1].replace(/\./g, ' ').trim();
  } else {
    // Alternative: extract everything after the year pattern
    const yearMatch = title.match(/\.(\d{4})\./);
    if (yearMatch) {
      const afterYear = title.split(yearMatch[0])[1];
      if (afterYear && afterYear.length > 5 && afterYear.length < 150) {
        subtitle = afterYear.replace(/\./g, ' ').trim();
      }
    }
  }
  
  // Try to extract poster URL from enclosure or media content
  let posterUrl: string | null = null;
  
  // Check enclosure - PT sites often use enclosure for images
  if (item.enclosure?.url) {
    const encUrl = String(item.enclosure.url);
    // Skip if URL contains "width" or is clearly not an image
    if (!encUrl.includes('width') && !encUrl.includes('height') && encUrl.length > 10) {
      posterUrl = encUrl;
    }
  }
  
  // Check media:content
  if (!posterUrl && item['media:content']?.$.url) {
    const mediaUrl = String(item['media:content'].$.url);
    if (!mediaUrl.includes('width') && mediaUrl.length > 10) {
      posterUrl = mediaUrl;
    }
  }
  
  // Check media:thumbnail
  if (!posterUrl && item['media:thumbnail']?.$.url) {
    const thumbUrl = String(item['media:thumbnail'].$.url);
    if (!thumbUrl.includes('width') && thumbUrl.length > 10) {
      posterUrl = thumbUrl;
    }
  }
  
  return {
    size: parseSize(text),
    free_tag: freeTag || parseFreeTag(text),
    seeders: parseSeeders(text),
    leechers: parseLeechers(text),
    downloads: parseDownloads(text),
    subtitle,
    poster_url: posterUrl,
  };
}

// Fetch RSS for a single source
export async function fetchSource(source: Source): Promise<number> {
  try {
    const feed = await parser.parseURL(source.url);
    let newCount = 0;

    console.log(`[FETCHER] Fetching source: ${source.name}, items: ${feed.items?.length || 0}`);

    const insertStmt = db.prepare(`
      INSERT INTO resources (source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size, subtitle, poster_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const checkStmt = db.prepare(`
      SELECT id FROM resources WHERE source_id = ? AND (guid = ? OR link = ?)
    `);

    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        const guid = item.guid || item.link || '';
        const link = item.link || '';
        console.log(`[FETCHER] Checking item: ${item.title?.substring(0, 50)}...`);
        const existing = checkStmt.get(source.id, guid, link);
        if (!existing) {
          insertStmt.run(
            source.id,
            item.title || 'Untitled',
            link,
            guid,
            item.pubDate || null,
            item.seeders || 0,
            item.leechers || 0,
            item.downloads || 0,
            item.free_tag || null,
            item.size || null,
            item.subtitle || null,
            item.poster_url || null
          );
          newCount++;
          console.log(`[FETCHER] Inserted: ${item.title?.substring(0, 30)}...`);
        } else {
          console.log(`[FETCHER] Skipped duplicate: ${item.title?.substring(0, 30)}...`);
        }
      }
    });

    const items = feed.items.map((item: any) => ({
      ...item,
      ...extractInfo(item),
    }));

    insertMany(items);
    
    console.log(`[FETCHER] Done fetching ${source.name}, newCount=${newCount}`);
    console.log(`[FETCHER] Total resources in DB: ${db.prepare('SELECT * FROM resources').all().length}`);

    // Update last fetch time
    db.prepare('UPDATE sources SET created_at = created_at WHERE id = ?').run(source.id);

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
