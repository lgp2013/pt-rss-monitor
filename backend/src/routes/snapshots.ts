import { Hono } from 'hono';
import db from '../db.js';

const snapshots = new Hono();

// GET /api/snapshots - List all snapshots
snapshots.get('/', (c) => {
  const snapshots = db.allSnapshots();
  return c.json({ data: snapshots });
});

// GET /api/snapshots/:id - Get single snapshot
snapshots.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const snapshot = db.getSnapshot(id);
  if (!snapshot) {
    return c.json({ error: 'Snapshot not found' }, 404);
  }
  return c.json({ data: snapshot });
});

// POST /api/snapshots - Create snapshot
snapshots.post('/', async (c) => {
  const body = await c.req.json();
  const { name, query, filters, result_ids, source_ids } = body;

  if (!name || !query) {
    return c.json({ error: 'name and query are required' }, 400);
  }

  const snapshot = db.addSnapshot({
    name,
    query,
    filters: filters || '{}',
    result_ids: result_ids || [],
    source_ids: source_ids || [],
  });

  return c.json({ data: snapshot }, 201);
});

// DELETE /api/snapshots/:id - Delete snapshot
snapshots.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const deleted = db.deleteSnapshot(id);
  if (!deleted) {
    return c.json({ error: 'Snapshot not found' }, 404);
  }
  return c.json({ success: true });
});

export default snapshots;
