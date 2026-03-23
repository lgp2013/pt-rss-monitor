import { Hono } from 'hono';
import Parser from 'rss-parser';
import { getFromPool } from '../db';

const rss = new Hono();
const parser = new Parser();

interface Resource {
  id: number;
  source_id: number;
  title: string;
  link: string;
  guid: string | null;
  pub_date: string | null;
  seeders: number;
  leechers: number;
  downloads: number;
  free_tag: string | null;
  size: string | null;
  created_at: string;
  subtitle?: string | null;
  poster_url?: string | null;
  category?: string | null;
  description?: string | null;
}

// Test RSS connection
rss.get('/test', async (c) => {
  const url = c.req.query('url');
  const cookie = c.req.query('cookie') || '';

  if (!url) {
    return c.json({ success: false, error: 'URL is required' });
  }

  try {
    const headers: Record<string, string> = {};
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const feed = await parser.parseURL(url);
    
    return c.json({
      success: true,
      itemCount: feed.items?.length || 0,
      title: feed.title || 'Unknown',
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch RSS',
    });
  }
});

// Fetch RSS from a source (with cookie support)
rss.post('/fetch', async (c) => {
  const { url, cookie } = await c.req.json();

  if (!url) {
    return c.json({ success: false, error: 'URL is required' });
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; PT-RSS-Monitor/1.0)',
    };
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const response = await fetch(url, { headers });
    const text = await response.text();
    const feed = await parser.parseString(text);

    return c.json({
      success: true,
      items: feed.items?.map(item => ({
        title: item.title,
        link: item.link,
        guid: item.guid,
        pubDate: item.pubDate,
        content: item.content,
        enclosure: item.enclosure,
      })) || [],
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message || 'Failed to fetch RSS',
    });
  }
});

export default rss;
