import { Hono } from 'hono';
import db from '../db.js';

const fetchlog = new Hono();

// GET /api/fetchlog - List fetch histories
fetchlog.get('/', (c) => {
  const histories = db.allFetchHistories();
  // Sort by fetched_at descending (most recent first)
  histories.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime());
  return c.json({ data: histories });
});

// POST /api/fetchlog - Add fetch history
fetchlog.post('/', async (c) => {
  const body = await c.req.json();
  const { source_id, source_name, status, message, new_resources } = body;

  if (source_id === undefined || !status) {
    return c.json({ error: 'source_id and status are required' }, 400);
  }

  const history = db.addFetchHistory({
    source_id,
    source_name: source_name || '',
    status,
    message: message || '',
    new_resources: new_resources || 0,
    fetched_at: new Date().toISOString(),
  });

  return c.json({ data: history }, 201);
});

// DELETE /api/fetchlog/source/:sourceId - Delete histories for a source
fetchlog.delete('/source/:sourceId', (c) => {
  const sourceId = parseInt(c.req.param('sourceId'), 10);
  db.deleteFetchHistoriesBySourceId(sourceId);
  return c.json({ success: true });
});

export default fetchlog;
