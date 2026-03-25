import { Hono, type Context } from 'hono';
import db from '../db.js';

const extension = new Hono();

type CookieRecord = {
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
};

function getSyncKeyFromRequest(c: Context): string {
  const authorization = c.req.header('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return (
    c.req.header('x-extension-key') ||
    c.req.header('x-sync-key') ||
    c.req.query('sync_key') ||
    ''
  ).trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeCookieMap(value: unknown): Record<string, string> {
  if (Array.isArray(value)) {
    return value.reduce<Record<string, string>>((result, item) => {
      if (!isObject(item)) return result;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) return result;
      result[name] = typeof item.value === 'string' ? item.value : '';
      return result;
    }, {});
  }

  if (isObject(value)) {
    return Object.entries(value).reduce<Record<string, string>>((result, [key, item]) => {
      if (!key.trim()) return result;
      result[key.trim()] = typeof item === 'string' ? item : String(item ?? '');
      return result;
    }, {});
  }

  return {};
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex <= 0) return result;
      const name = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      if (!name) return result;
      result[name] = value;
      return result;
    }, {});
}

function buildCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([name]) => !!name)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

extension.post('/site-cookie-sync', async (c) => {
  const providedKey = getSyncKeyFromRequest(c);
  const expectedKey = db.getOrCreateExtensionSyncKey();

  if (!providedKey || providedKey !== expectedKey) {
    return c.json({ error: 'Invalid extension sync key' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const targetUrl = String(body.url || body.site_url || body.origin || body.domain || '').trim();
  if (!targetUrl) {
    return c.json({ error: 'Target site URL is required' }, 400);
  }

  const site = db.findSiteByUrl(targetUrl);
  if (!site) {
    return c.json({ error: 'No configured site matched this URL', matched: false }, 404);
  }

  const cookiesFromPayload = normalizeCookieMap(body.cookies);
  const cookieHeaderFromPayload = typeof body.cookie === 'string' ? body.cookie.trim() : '';
  const mergedCookies = {
    ...parseCookieHeader(cookieHeaderFromPayload),
    ...cookiesFromPayload,
  };
  const cookieHeader = buildCookieHeader(mergedCookies);

  if (!cookieHeader) {
    return c.json({ error: 'No cookies found in request body' }, 400);
  }

  const updated = db.updateSite(site.id, {
    cookie: cookieHeader,
    cookies: mergedCookies,
    cookie_updated_at: new Date().toISOString(),
    cookie_sync_mode: 'extension',
  });

  return c.json({
    success: true,
    matched: true,
    site: {
      id: updated?.id ?? site.id,
      name: updated?.name ?? site.name,
      site_url: updated?.site_url ?? site.site_url,
      cookie_updated_at: updated?.cookie_updated_at ?? null,
      cookie_sync_mode: updated?.cookie_sync_mode ?? null,
    },
    cookie_names: Object.keys(mergedCookies),
  });
});

extension.get('/site-cookie-sync/health', (c) => {
  return c.json({ status: 'ok' });
});

export default extension;
