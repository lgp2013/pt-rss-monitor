import { Hono } from 'hono';
import db from '../db.js';
import type { Setting } from '../types.js';

const settings = new Hono();
const SOURCE_CATEGORIES_KEY = 'source_categories';

function getSettingsMap(): Record<string, string> {
  const rows = db.prepare('SELECT * FROM settings').all() as Setting[];
  const settingsMap: Record<string, string> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }
  return settingsMap;
}

function getStoredCategories(): string[] {
  const raw = db.getSetting(SOURCE_CATEGORIES_KEY)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function saveCategories(categories: string[]) {
  const normalized = [...new Set(categories.map(item => item.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  db.updateSetting(SOURCE_CATEGORIES_KEY, JSON.stringify(normalized));
  return normalized;
}

settings.get('/stats', (c) => {
  const totalSources = db.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number };
  const totalResources = db.prepare('SELECT COUNT(*) as count FROM resources').get() as { count: number };
  const totalSites = db.prepare('SELECT COUNT(*) as count FROM sites').get() as { count: number };

  const sources = db.prepare('SELECT id, category FROM sources').all() as { id: number; category: string }[];
  const categoryMap: Record<string, number> = {};
  for (const source of sources) {
    const category = source.category || '未分类';
    categoryMap[category] = (categoryMap[category] || 0) + 1;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resourcesToday = db.prepare('SELECT COUNT(*) as count FROM resources WHERE created_at >= ?').get(today.toISOString()) as {
    count: number;
  };

  return c.json({
    total_sources: totalSources.count,
    total_resources: totalResources.count,
    total_sites: totalSites.count,
    sources_by_category: categoryMap,
    resources_today: resourcesToday.count,
  });
});

settings.get('/categories', (c) => {
  const stored = getStoredCategories();
  const usedBySources = db.prepare('SELECT category FROM sources').all() as { category: string }[];
  const categories = [...new Set([...stored, ...usedBySources.map(item => item.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
  if (categories.join('|') !== stored.join('|')) {
    saveCategories(categories);
  }
  return c.json({ categories });
});

settings.get('/extension-sync', (c) => {
  return c.json({
    sync_key: db.getOrCreateExtensionSyncKey(),
    endpoint_path: '/api/extension/site-cookie-sync',
    health_path: '/api/extension/site-cookie-sync/health',
  });
});

settings.post('/extension-sync/regenerate', (c) => {
  return c.json({
    success: true,
    sync_key: db.regenerateExtensionSyncKey(),
    endpoint_path: '/api/extension/site-cookie-sync',
    health_path: '/api/extension/site-cookie-sync/health',
  });
});

settings.post('/categories', async (c) => {
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  if (!name) {
    return c.json({ error: 'Category name is required' }, 400);
  }
  const categories = saveCategories([...getStoredCategories(), name]);
  return c.json({ categories });
});

settings.delete('/categories/:name', (c) => {
  const name = decodeURIComponent(c.req.param('name')).trim();
  if (!name) {
    return c.json({ error: 'Category name is required' }, 400);
  }

  const categories = saveCategories(getStoredCategories().filter(item => item !== name));
  const sources = db.allSources().filter(source => source.category === name);
  for (const source of sources) {
    db.updateSource(source.id, { category: '' });
  }

  return c.json({ success: true, categories });
});

settings.get('/', (c) => {
  return c.json(getSettingsMap());
});

settings.put('/', async (c) => {
  const body = await c.req.json();

  const updateStmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const updateMany = db.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) {
      updateStmt.run(key, value);
    }
  });

  const entries = Object.entries(body).map(([key, value]) => [key, String(value)]) as [string, string][];
  updateMany(entries);

  return c.json({ success: true });
});

settings.get('/:key', (c) => {
  const key = c.req.param('key');
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key) as Setting | undefined;
  if (!row) {
    return c.json({ error: 'Setting not found' }, 404);
  }
  return c.json({ key: row.key, value: row.value });
});

settings.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value } = await c.req.json();

  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));

  return c.json({ success: true });
});

export default settings;
