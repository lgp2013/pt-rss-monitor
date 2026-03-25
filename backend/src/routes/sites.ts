import { Hono } from 'hono';
import db from '../db.js';
import type { Site } from '../types.js';

const sites = new Hono();

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

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

sites.get('/', (c) => c.json(db.allSites()));

sites.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const site = db.getSite(id);
  if (!site) return c.json({ error: 'Site not found' }, 404);
  return c.json(site);
});

sites.post('/', async (c) => {
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  const siteUrl = String(body.site_url || '').trim();
  if (!name || !siteUrl) return c.json({ error: 'Name and site URL are required' }, 400);

  const created = db.addSite({
    name,
    site_url: siteUrl,
    category: String(body.category || '').trim(),
    enabled: parseEnabled(body.enabled, 1),
    cookie: typeof body.cookie === 'string' ? body.cookie : undefined,
    cookies: typeof body.cookies === 'object' ? body.cookies : undefined,
    groups: parseStringArray(body.groups),
    is_offline: parseEnabled(body.is_offline, 0),
    allow_search: parseEnabled(body.allow_search, 1),
    allow_query_user_info: parseEnabled(body.allow_query_user_info, 1),
    allow_content_script: parseEnabled(body.allow_content_script, 1),
    custom_name: typeof body.custom_name === 'string' ? body.custom_name.trim() : null,
    timezone_offset: typeof body.timezone_offset === 'string' ? body.timezone_offset : '+0800',
    passkey: typeof body.passkey === 'string' ? body.passkey : null,
    download_link_appendix: typeof body.download_link_appendix === 'string' ? body.download_link_appendix : null,
    request_timeout: parseNumber(body.request_timeout, 30000),
    download_interval: parseNumber(body.download_interval, 0),
    upload_speed_limit: parseNumber(body.upload_speed_limit, 0),
  });
  return c.json(created, 201);
});

sites.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const existing = db.getSite(id);
  if (!existing) return c.json({ error: 'Site not found' }, 404);
  const body = await c.req.json();
  const updates: Partial<Site> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.site_url !== undefined) updates.site_url = String(body.site_url).trim();
  if (body.category !== undefined) updates.category = String(body.category).trim();
  if (body.enabled !== undefined) updates.enabled = parseEnabled(body.enabled, existing.enabled);
  if (body.cookie !== undefined) updates.cookie = typeof body.cookie === 'string' ? body.cookie : undefined;
  if (body.cookies !== undefined) updates.cookies = typeof body.cookies === 'object' ? body.cookies : undefined;
  if (body.groups !== undefined) updates.groups = parseStringArray(body.groups);
  if (body.is_offline !== undefined) updates.is_offline = parseEnabled(body.is_offline, existing.is_offline ?? 0);
  if (body.allow_search !== undefined) updates.allow_search = parseEnabled(body.allow_search, existing.allow_search ?? 1);
  if (body.allow_query_user_info !== undefined) updates.allow_query_user_info = parseEnabled(body.allow_query_user_info, existing.allow_query_user_info ?? 1);
  if (body.allow_content_script !== undefined) updates.allow_content_script = parseEnabled(body.allow_content_script, existing.allow_content_script ?? 1);
  if (body.custom_name !== undefined) updates.custom_name = body.custom_name ? String(body.custom_name).trim() : null;
  if (body.timezone_offset !== undefined) updates.timezone_offset = body.timezone_offset ? String(body.timezone_offset) : null;
  if (body.passkey !== undefined) updates.passkey = body.passkey ? String(body.passkey) : null;
  if (body.download_link_appendix !== undefined) updates.download_link_appendix = body.download_link_appendix ? String(body.download_link_appendix) : null;
  if (body.request_timeout !== undefined) updates.request_timeout = parseNumber(body.request_timeout, existing.request_timeout ?? 30000);
  if (body.download_interval !== undefined) updates.download_interval = parseNumber(body.download_interval, existing.download_interval ?? 0);
  if (body.upload_speed_limit !== undefined) updates.upload_speed_limit = parseNumber(body.upload_speed_limit, existing.upload_speed_limit ?? 0);
  return c.json(db.updateSite(id, updates));
});

sites.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const deleted = db.deleteSite(id);
  if (!deleted) return c.json({ error: 'Site not found' }, 404);
  return c.json({ success: true });
});

export default sites;
