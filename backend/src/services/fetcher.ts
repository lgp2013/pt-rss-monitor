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
  const descText = item.description || '';
  
  // Extract clean title and free tag
  const { title: cleanTitle, freeTag } = extractCleanTitle(title);
  
  // Extract subtitle from title - format specs after the main title
  // Example: "BLUE EYE SAMURAI S01 2023 Complete 1080p Netflix WEB-DL AVC DDP 5.1 Atmos-DBTV"
  // -> "1080p Netflix WEB-DL AVC DDP 5.1"
  let subtitle: string | null = null;
  const resMatch = title.match(/(2160p|1080p|720p|480p)/i);
  if (resMatch) {
    const idx = title.indexOf(resMatch[1]);
    const afterRes = title.substring(idx + resMatch[1].length);
    subtitle = (resMatch[1] + ' ' + afterRes).substring(0, 60).trim();
  }
  
  // Try to extract poster URL from description (most reliable for PT sites)
  let posterUrl: string | null = null;
  
  // Check description field for ptgen_poster (usually the main poster)
  if (descText) {
    // Look for ptgen_poster first (most common poster format)
    const ptgenMatch = descText.match(/src=["']([^"']*ptgen_poster[^"']*)["']/i);
    if (ptgenMatch && ptgenMatch[1]) {
      posterUrl = ptgenMatch[1];
    } else {
      // Fallback: first image in description
      const imgMatch = descText.match(/src=["']([^"']+\.(?:jpg|jpeg|png|gif|webp)[^"']*)["']/i);
      if (imgMatch && imgMatch[1] && imgMatch[1].length > 10) {
        posterUrl = imgMatch[1];
      }
    }
  }
  
  // Check enclosure (sometimes contains image)
  if (!posterUrl && item.enclosure?.url) {
    const encUrl = String(item.enclosure.url);
    if (!encUrl.includes('width') && encUrl.length > 10 && !encUrl.includes('bittorrent')) {
      posterUrl = encUrl;
    }
  }
  
  // Check media:thumbnail
  if (!posterUrl && item['media:thumbnail']?.$.url) {
    const thumbUrl = String(item['media:thumbnail'].$.url);
    if (thumbUrl && thumbUrl.length > 10) {
      posterUrl = thumbUrl;
    }
  }
  
  // Extract category from RSS item's <category> tag
  let itemCategory: string | null = null;
  if (item.category) {
    // RSS category can be string or object with $
    if (typeof item.category === 'string') {
      itemCategory = item.category;
    } else if (item.category['#'] || item.category.$) {
      itemCategory = item.category['#'] || item.category.$;
    } else if (typeof item.category === 'object') {
      itemCategory = String(item.category);
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
    category: itemCategory, // Override source category with item's category if present
  };
}

// Fetch RSS for a single source
export async function fetchSource(source: Source): Promise<number> {
  try {
    const feed = await parser.parseURL(source.url);
    let newCount = 0;

    console.log(`[FETCHER] Fetching source: ${source.name}, items: ${feed.items?.length || 0}`);

    const insertStmt = db.prepare(`
      INSERT INTO resources (source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size, subtitle, poster_url, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const checkStmt = db.prepare(`
      SELECT id FROM resources WHERE source_id = ? AND (guid = ? OR link = ?)
    `);

    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        const guid = item.guid || item.link || '';
        const link = item.link || '';
        console.log(`[FETCHER] Checking item: ${item.title?.substring(0, 50)}...`);
        const existingId = checkStmt.get(source.id, guid, link);
        if (!existingId) {
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
            item.poster_url || null,
            item.category || source.category // Use item category if present, else source category
          );
          newCount++;
          console.log(`[FETCHER] Inserted: ${item.title?.substring(0, 30)}...`);
        } else {
          // Resource exists, check if we need to update subtitle or poster_url
          const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(existingId.id);
          if (existing && (item.subtitle || item.poster_url || item.category)) {
            // Update only if we have new values
            const updateStmt = db.prepare(`
              UPDATE resources 
              SET subtitle = COALESCE(?, subtitle),
                  poster_url = COALESCE(?, poster_url),
                  category = COALESCE(?, category)
              WHERE id = ?
            `);
            updateStmt.run(item.subtitle, item.poster_url, item.category, existingId.id);
            console.log(`[FETCHER] Updated fields for: ${item.title?.substring(0, 30)}...`);
          } else {
            console.log(`[FETCHER] Skipped duplicate: ${item.title?.substring(0, 30)}...`);
          }
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
