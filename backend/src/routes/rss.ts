import { Hono } from 'hono';
import db from '../db.js';
import { fetchAllSources, fetchSource } from '../services/fetcher.js';
import type { Source } from '../types.js';

const rss = new Hono();

function parseEnabled(value: unknown, fallback = 1): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return 1;
    if (['false', '0', 'no', 'off'].includes(normalized)) return 0;
  }
  return fallback;
}

function parseInterval(value: unknown, fallback = 30): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// GET /api/sources - list all RSS sources
rss.get('/', (c) => {
  return c.json(db.allSources());
});

// GET /api/sources/:id - get a single source
rss.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const source = db.getSource(id);

  if (!source) {
    return c.json({ error: 'Source not found' }, 404);
  }

  return c.json(source);
});

// POST /api/sources - create a source
rss.post('/', async (c) => {
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  const url = String(body.url || '').trim();
  if (!name || !url) {
    return c.json({ error: 'Name and URL are required' }, 400);
  }

  const created = db.addSource({
    name,
    url,
    category: String(body.category || '').trim(),
    fetch_interval: parseInterval(body.fetch_interval, 30),
    enabled: parseEnabled(body.enabled, 1),
  });

  return c.json(created, 201);
});

// PUT /api/sources/:id - update a source
rss.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const existing = db.getSource(id);

  if (!existing) {
    return c.json({ error: 'Source not found' }, 404);
  }

  const body = await c.req.json();
  const updates: Partial<Source> = {};

  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.url !== undefined) updates.url = String(body.url).trim();
  if (body.category !== undefined) updates.category = String(body.category).trim();
  if (body.fetch_interval !== undefined) updates.fetch_interval = parseInterval(body.fetch_interval, existing.fetch_interval);
  if (body.enabled !== undefined) updates.enabled = parseEnabled(body.enabled, existing.enabled);

  const updated = db.updateSource(id, updates);
  return c.json(updated);
});

// DELETE /api/sources/:id - delete a source and its resources
rss.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const deleted = db.deleteSource(id);

  if (!deleted) {
    return c.json({ error: 'Source not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /api/sources/:id/fetch - fetch a single source
rss.post('/:id/fetch', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const source = db.getSource(id);

  if (!source) {
    return c.json({ error: 'Source not found' }, 404);
  }

  const newResources = await fetchSource(source);
  return c.json({ success: true, new_resources: newResources });
});

// POST /api/sources/fetch-all - fetch all enabled sources
rss.post('/fetch-all', async (c) => {
  await fetchAllSources();
  return c.json({ success: true });
});

export default rss;
