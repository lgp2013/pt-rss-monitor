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
  // Try to find size in text (e.g., "10.5 GB", "1.2GB", "500MB")
  const match = text.match(/(\d+\.?\d*)\s*([GMKT]B?)/i);
  if (match) {
    return `${match[1]} ${match[2].toUpperCase()}`;
  }
  return null;
}

function parseSizeFromLength(bytes: number | string | undefined): string | null {
  if (!bytes) return null;
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num <= 0) return null;
  const gb = num / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = num / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
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
  // Extract free tag from [FREE], [50%], [免费] etc. brackets
  let freeTag: string | null = null;
  let cleanTitle = title;
  
  // Pattern to match [FREE], [50%], [免费], [0%], [100%] etc.
  const bracketMatch = title.match(/\[(免费|FREE|50%|\d+%|[01]00%)\]/i);
  if (bracketMatch) {
    const tag = bracketMatch[1].toUpperCase();
    if (tag === '免费' || tag === 'FREE' || tag === '0%' || tag === '100%') {
      freeTag = 'FREE';
    } else if (tag.endsWith('%')) {
      freeTag = tag;
    } else {
      freeTag = tag;
    }
    // Remove the bracket tag from title
    cleanTitle = title.replace(/\s*\[\s*(免费|FREE|50%|\d+%|[01]00%)\s*\]\s*/gi, '').trim();
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

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatDescription(html: string): string | null {
  if (!html) return null;
  const withoutImages = html.replace(/<img[^>]*>/gi, ' ');
  const text = decodeHtml(
    withoutImages
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, ''),
  )
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return text.substring(0, 2000) || null;
}

function extractTranslatedName(description: string | null): string | null {
  if (!description) return null;
  const normalized = description
    .replace(/\u3000/g, ' ')
    .replace(/[：:]/g, ' ')
    .replace(/[ \t]+/g, ' ');
  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cleanedLine = line
      .replace(/^◎\s*/, '')
      .replace(/^â\s*/, '')
      .trim();
    const match = cleanedLine.match(/^(?:译\s*名|è¯\s*å)\s+(.+)$/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// Extract info from item
function extractInfo(item: Record<string, any>): Partial<Resource> {
  const title = item.title || '';
  // Check various fields for description content
  const rawDesc = item.description || item.content || item.summary || '';
  console.log(`[FETCHER DEBUG] item.description type: ${typeof item.description}, length: ${item.description?.length || 0}`);
  console.log(`[FETCHER DEBUG] item.content type: ${typeof item.content}, length: ${item.content?.length || 0}`);
  const text = `${title} ${rawDesc}`;
  const descText = rawDesc;
  
  // Extract clean title and free tag
  const { title: cleanTitle, freeTag } = extractCleanTitle(title);
  
  // Extract subtitle from title - everything after the resolution
  // Example: "Mickey Mouse Clubhouse S01 2025 1080p DSNP WEB-DL H.264 DDP 5.1-FFG"
  // -> "1080p DSNP WEB-DL H.264 DDP 5.1"
  let subtitle: string | null = null;
  const resMatch = title.match(/(2160p|1080p|720p|480p)/i);
  if (resMatch) {
    const idx = title.indexOf(resMatch[1]);
    const afterRes = title.substring(idx + resMatch[1].length);
    // Take everything after resolution until we hit a year (4 digits) or too long
    const beforeYear = afterRes.replace(/\s*\d{4}\s*$/, '').trim();
    subtitle = (resMatch[1] + ' ' + beforeYear).substring(0, 50).trim();
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
  
  const formattedDescription = formatDescription(descText);

  return {
    size: parseSize(text) || parseSizeFromLength(item.enclosure?.length),
    free_tag: freeTag || parseFreeTag(text),
    seeders: parseSeeders(text),
    leechers: parseLeechers(text),
    downloads: parseDownloads(text),
    subtitle,
    poster_url: posterUrl,
    category: itemCategory,
    translated_name: extractTranslatedName(formattedDescription),
    description: formattedDescription,
    description_html: descText || null,
  };
}

// Fetch RSS for a single source
export async function fetchSource(source: Source): Promise<number> {
  try {
    const feed = await parser.parseURL(source.url);
    let newCount = 0;

    console.log(`[FETCHER] Fetching source: ${source.name}, items: ${feed.items?.length || 0}`);

    const insertStmt = db.prepare(`
      INSERT INTO resources (source_id, title, translated_name, link, guid, pub_date, seeders, leechers, downloads, free_tag, size, subtitle, poster_url, category, description, description_html)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            item.translated_name || null,
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
            item.category || source.category,
            item.description || null,
            item.description_html || null
          );
          newCount++;
          console.log(`[FETCHER] Inserted: ${item.title?.substring(0, 30)}...`);
        } else {
          // Resource exists, check if we need to update subtitle or poster_url
          const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(existingId.id);
          if (existing && (item.translated_name || item.subtitle || item.poster_url || item.category || item.description || item.description_html)) {
            // Update only if we have new values
            const updateStmt = db.prepare(`
              UPDATE resources 
              SET translated_name = COALESCE(?, translated_name),
                  subtitle = COALESCE(?, subtitle),
                  poster_url = COALESCE(?, poster_url),
                  category = COALESCE(?, category),
                  description = COALESCE(?, description),
                  description_html = COALESCE(?, description_html)
              WHERE id = ?
            `);
            updateStmt.run(item.translated_name, item.subtitle, item.poster_url, item.category, item.description, item.description_html, existingId.id);
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
