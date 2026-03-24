import { Hono } from 'hono';
import db from '../db.js';

const keywordRules = new Hono();

// GET /api/keyword-rules - List all rules
keywordRules.get('/', (c) => {
  return c.json(db.allKeywordRules());
});

// GET /api/keyword-rules/:id
keywordRules.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const rule = db.getKeywordRule(id);
  if (!rule) return c.json({ error: 'Rule not found' }, 404);
  return c.json(rule);
});

// POST /api/keyword-rules - Create rule
keywordRules.post('/', async (c) => {
  const body = await c.req.json();
  const { name, keywords, exclude, source_ids, enabled } = body;

  if (!name || !keywords || !Array.isArray(keywords)) {
    return c.json({ error: 'name and keywords[] are required' }, 400);
  }

  const rule = db.addKeywordRule({
    name,
    keywords,
    exclude: exclude || [],
    source_ids: source_ids || [],
    enabled: enabled !== false,
  });

  return c.json(rule, 201);
});

// PUT /api/keyword-rules/:id
keywordRules.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();
  const rule = db.updateKeywordRule(id, body);
  if (!rule) return c.json({ error: 'Rule not found' }, 404);
  return c.json(rule);
});

// DELETE /api/keyword-rules/:id
keywordRules.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const deleted = db.deleteKeywordRule(id);
  if (!deleted) return c.json({ error: 'Rule not found' }, 404);
  return c.json({ success: true });
});

// Match a resource against all rules (for testing)
keywordRules.post('/match', async (c) => {
  const { title, source_id, link } = await c.req.json();
  const matched = db.matchKeywordRules({ title, source_id, link });
  return c.json({ matched });
});

export default keywordRules;
