import { createHash } from 'crypto';
import { Hono } from 'hono';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { User } from '../types.js';

const auth = new Hono();

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function isStrongPassword(password: string): boolean {
  return /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

auth.post('/login', async (c) => {
  const body = await c.req.json();
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  const user = db.getUserByUsername(username);
  if (!user || !db.verifyPassword(user, password)) {
    return c.json({ error: 'Invalid username or password' }, 401);
  }

  const session = db.createAuthSession(user.id);
  return c.json({
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      is_system: user.is_system,
    },
  });
});

auth.use('/me', requireAuth);
auth.get('/me', (c) => {
  const user = c.get('authUser' as never) as User;
  return c.json({
    id: user.id,
    username: user.username,
    is_system: user.is_system,
  });
});

auth.use('/logout', requireAuth);
auth.post('/logout', (c) => {
  const token = c.get('authToken' as never) as string;
  db.deleteAuthSession(token);
  return c.json({ success: true });
});

auth.use('/change-password', requireAuth);
auth.post('/change-password', async (c) => {
  const body = await c.req.json();
  const currentPassword = String(body.current_password || '');
  const newPassword = String(body.new_password || '');
  const confirmPassword = String(body.confirm_password || '');
  const user = c.get('authUser' as never) as User;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return c.json({ error: 'All password fields are required' }, 400);
  }

  if (!db.verifyPassword(user, currentPassword)) {
    return c.json({ error: 'Current password is incorrect' }, 400);
  }

  if (newPassword !== confirmPassword) {
    return c.json({ error: 'New password and confirmation do not match' }, 400);
  }

  if (!isStrongPassword(newPassword)) {
    return c.json({ error: 'Password must include letters, numbers, and special characters' }, 400);
  }

  if (currentPassword === newPassword) {
    return c.json({ error: 'New password must be different from the current password' }, 400);
  }

  db.updateUser(user.id, { password_hash: hashPassword(newPassword) });
  db.deleteAuthSessionsByUserId(user.id);
  const session = db.createAuthSession(user.id);

  return c.json({
    success: true,
    token: session.token,
  });
});

auth.use('/reset-admin-password', requireAuth);
auth.post('/reset-admin-password', (c) => {
  const user = c.get('authUser' as never) as User;

  if (user.username !== 'admin') {
    return c.json({ error: 'Only admin can reset the admin password' }, 403);
  }

  const adminUser = db.getUserByUsername('admin');
  if (!adminUser) {
    return c.json({ error: 'Admin user not found' }, 404);
  }

  db.updateUser(adminUser.id, { password_hash: hashPassword('admin@123') });
  db.deleteAuthSessionsByUserId(adminUser.id);
  const session = db.createAuthSession(adminUser.id);

  return c.json({
    success: true,
    token: session.token,
    default_password: 'admin@123',
  });
});

export default auth;
