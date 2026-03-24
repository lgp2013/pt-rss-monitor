import { Hono } from 'hono';
import db from '../db.js';
import { fetchSource } from '../services/fetcher.js';

const sources = new Hono();

// GET /api/sources - List all sources
sources.get('/', (c) => {
  const allSources = db.allSources();
  const allHistories = db.allFetchHistories();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const sourcesWithStats = allSources.map(source => {
    const sourceResources = db.allResources().filter(r => r.source_id === source.id);
    const todayResources = sourceResources.filter(r => new Date(r.created_at) >= today);

    // Compute health stats from fetch history
    const sourceHistories = allHistories
      .filter(h => h.source_id === source.id)
      .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime());

    const successHistories = sourceHistories.filter(h => h.status === 'success');
    const totalAttempts = sourceHistories.length;
    const successCount = successHistories.length;
    const successRate = totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 100) : null;

    // Last successful fetch
    const lastSuccess = successHistories[0] || null;

    // Consecutive failures (from most recent)
    let consecutiveFailures = 0;
    for (const h of sourceHistories) {
      if (h.status === 'error') consecutiveFailures++;
      else break;
    }

    return {
      ...source,
      total_resources: sourceResources.length,
      today_resources: todayResources.length,
      health: {
        total_attempts: totalAttempts,
        success_count: successCount,
        success_rate: successRate,
        last_success_at: lastSuccess?.fetched_at || null,
        last_fetch_at: sourceHistories[0]?.fetched_at || null,
        last_fetch_status: sourceHistories[0]?.status || null,
        last_fetch_message: sourceHistories[0]?.message || null,
        consecutive_failures: consecutiveFailures,
      },
    };
  });

  return c.json(sourcesWithStats);
});

// POST /api/sources - Create source
sources.post('/', async (c) => {
  const body = await c.req.json();
  const { name, url, category, fetch_interval, enabled, cookie } = body;

  if (!name || !url) {
    return c.json({ error: 'name and url are required' }, 400);
  }

  const source = db.addSource({
    name,
    url,
    category: category || '',
    fetch_interval: fetch_interval || 30,
    enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1,
    cookie: cookie || '',
  });

  return c.json({ data: source }, 201);
});

// GET /api/sources/:id - Get single source
sources.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const source = db.getSource(id);
  if (!source) {
    return c.json({ error: 'Source not found' }, 404);
  }
  return c.json({ data: source });
});

// PUT /api/sources/:id - Update source
sources.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();
  const { name, url, category, fetch_interval, enabled, cookie } = body;

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (url !== undefined) updates.url = url;
  if (category !== undefined) updates.category = category;
  if (fetch_interval !== undefined) updates.fetch_interval = fetch_interval;
  if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
  if (cookie !== undefined) updates.cookie = cookie;

  const updated = db.updateSource(id, updates);
  if (!updated) {
    return c.json({ error: 'Source not found' }, 404);
  }
  return c.json({ data: updated });
});

// DELETE /api/sources/:id - Delete source
sources.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const deleted = db.deleteSource(id);
  if (!deleted) {
    return c.json({ error: 'Source not found' }, 404);
  }
  return c.json({ success: true });
});

// POST /api/sources/:id/fetch - Fetch single source
sources.post('/:id/fetch', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const source = db.getSource(id);
  if (!source) {
    return c.json({ error: 'Source not found' }, 404);
  }

  try {
    const newResources = await fetchSource(source);
    return c.json({ success: true, new_resources: newResources });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/sources/fetch-all - Fetch all enabled sources
sources.post('/fetch-all', async (c) => {
  try {
    const { fetchAllSources } = await import('../services/fetcher.js');
    await fetchAllSources();
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default sources;
