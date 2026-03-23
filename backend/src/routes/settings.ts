import { Hono } from 'hono';
import db from '../db.js';
import type { Setting } from '../types.js';

const settings = new Hono();

// GET /api/settings - Get all settings
settings.get('/', (c) => {
  const rows = db.prepare('SELECT * FROM settings').all() as Setting[];
  const settingsMap: Record<string, string> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }
  return c.json(settingsMap);
});

// PUT /api/settings - Update settings
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

  const entries = Object.entries(body) as [string, string][];
  updateMany(entries);

  return c.json({ success: true });
});

// GET /api/settings/:key - Get single setting
settings.get('/:key', (c) => {
  const key = c.req.param('key');
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key) as Setting | undefined;
  if (!row) {
    return c.json({ error: 'Setting not found' }, 404);
  }
  return c.json({ key: row.key, value: row.value });
});

// PUT /api/settings/:key - Update single setting
settings.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value } = await c.req.json();

  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);

  return c.json({ success: true });
});

// GET /api/stats - Get statistics
settings.get('/stats', (c) => {
  const totalSources = db.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number };
  const totalResources = db.prepare('SELECT COUNT(*) as count FROM resources').get() as { count: number };

  // Resources by category - manually since InMemoryDB doesn't support GROUP BY
  const sources = db.prepare('SELECT id, category FROM sources').all() as { id: number; category: string }[];
  const categoryMap: Record<string, number> = {};
  for (const source of sources) {
    const cat = source.category || '未分类';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  }

  // Resources added today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const resourcesToday = db.prepare(`
    SELECT COUNT(*) as count FROM resources WHERE created_at >= ?
  `).get(todayStr) as { count: number };

  return c.json({
    total_sources: totalSources.count,
    total_resources: totalResources.count,
    sources_by_category: categoryMap,
    resources_today: resourcesToday.count,
  });
});

// GET /api/settings/categories - Get all unique categories
settings.get('/categories', (c) => {
  const sources = db.prepare('SELECT category FROM sources').all() as { category: string }[];
  const categories = [...new Set(sources.map(s => s.category).filter(Boolean))];
  return c.json({ categories });
});

export default settings;
