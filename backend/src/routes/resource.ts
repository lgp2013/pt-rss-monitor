import { Hono } from 'hono';
import db from '../db.js';
import { cleanOldResources } from '../services/fetcher.js';
import type { Resource } from '../types.js';

const resource = new Hono();

// GET /api/resources - List resources with pagination and filters
resource.get('/', (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const sourceId = c.req.query('source_id');
  const category = c.req.query('category');
  const search = c.req.query('search');
  const sortBy = c.req.query('sort_by') || 'created_at';
  const sortOrder = c.req.query('sort_order') || 'desc';

  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: any[] = [];

  if (sourceId) {
    whereClause += ' AND r.source_id = ?';
    params.push(parseInt(sourceId, 10));
  }

  if (category) {
    whereClause += ' AND s.category = ?';
    params.push(category);
  }

  if (search) {
    whereClause += ' AND r.title LIKE ?';
    params.push(`%${search}%`);
  }

  const validSortColumns = ['created_at', 'pub_date', 'title', 'seeders', 'size'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM resources r
    JOIN sources s ON r.source_id = s.id
    WHERE ${whereClause}
  `;
  const { total } = db.prepare(countQuery).get(...params) as { total: number };

  // Get resources
  const query = `
    SELECT r.*, s.name as source_name, s.category
    FROM resources r
    JOIN sources s ON r.source_id = s.id
    WHERE ${whereClause}
    ORDER BY r.${sortColumn} ${order}
    LIMIT ? OFFSET ?
  `;

  const resources = db.prepare(query).all(...params, limit, offset) as (Resource & { source_name: string; category: string })[];

  return c.json({
    data: resources,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

// DELETE /api/resources/:id - Delete single resource
resource.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);

  const result = db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  if (result.changes === 0) {
    return c.json({ error: 'Resource not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /api/resources/clean - Clean old resources
resource.post('/clean', (c) => {
  const days = parseInt(c.req.query('days') || '30', 10);
  const deleted = cleanOldResources(days);
  return c.json({ success: true, deleted });
});

// POST /api/resources/clean-all - Clean all resources (with confirmation)
resource.post('/clean-all', (c) => {
  const result = db.prepare('DELETE FROM resources').run();
  return c.json({ success: true, deleted: result.changes });
});

export default resource;
