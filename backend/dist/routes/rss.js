import { Hono } from 'hono';
import db from '../db.js';
import { fetchSource, fetchAllSources } from '../services/fetcher.js';
const rss = new Hono();
// GET /api/sources - List all sources
rss.get('/', (c) => {
    const sources = db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all();
    return c.json(sources);
});
// POST /api/sources - Create new source
rss.post('/', async (c) => {
    const body = await c.req.json();
    const { name, url, category, fetch_interval, enabled } = body;
    if (!name || !url) {
        return c.json({ error: 'name and url are required' }, 400);
    }
    try {
        const result = db.prepare(`
      INSERT INTO sources (name, url, category, fetch_interval, enabled)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, url, category || '其他', fetch_interval || 30, enabled !== undefined ? (enabled ? 1 : 0) : 1);
        const newSource = db.prepare('SELECT * FROM sources WHERE id = ?').get(result.lastInsertRowid);
        return c.json(newSource, 201);
    }
    catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return c.json({ error: 'URL already exists' }, 400);
        }
        throw error;
    }
});
// PUT /api/sources/:id - Update source
rss.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { name, url, category, fetch_interval, enabled } = body;
    const existing = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
    if (!existing) {
        return c.json({ error: 'Source not found' }, 404);
    }
    try {
        db.prepare(`
      UPDATE sources SET name = ?, url = ?, category = ?, fetch_interval = ?, enabled = ?
      WHERE id = ?
    `).run(name ?? existing.name, url ?? existing.url, category ?? existing.category, fetch_interval ?? existing.fetch_interval, enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled, id);
        const updated = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
        return c.json(updated);
    }
    catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return c.json({ error: 'URL already exists' }, 400);
        }
        throw error;
    }
});
// DELETE /api/sources/:id - Delete source
rss.delete('/:id', (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const result = db.prepare('DELETE FROM sources WHERE id = ?').run(id);
    if (result.changes === 0) {
        return c.json({ error: 'Source not found' }, 404);
    }
    return c.json({ success: true });
});
// POST /api/sources/:id/fetch - Manual fetch for a source
rss.post('/:id/fetch', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
    if (!source) {
        return c.json({ error: 'Source not found' }, 404);
    }
    const newCount = await fetchSource(source);
    return c.json({ success: true, new_resources: newCount });
});
// POST /api/sources/fetch-all - Fetch all enabled sources
rss.post('/fetch-all', async (c) => {
    await fetchAllSources();
    return c.json({ success: true });
});
export default rss;
