import type { Context, Next } from 'hono';
import db from '../db.js';

export async function requireAuth(c: Context, next: Next) {
  const authorization = c.req.header('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const session = db.getAuthSession(token);
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    db.deleteAuthSession(token);
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('authToken', token);
  c.set('authUser', user);
  await next();
}
