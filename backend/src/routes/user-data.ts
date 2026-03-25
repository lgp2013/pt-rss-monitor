import { Hono } from 'hono';
import db from '../db.js';

const userData = new Hono();
const refreshQueue = new Map<number, Promise<any>>();

function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanInlineText(text: string): string {
  return stripHtml(decodeHtmlEntities(text)).replace(/\s+/g, ' ').trim();
}

function parseSizeToBytes(text: string | null): number {
  if (!text) return 0;
  const normalized = text.replace(/,/g, '');
  const match = normalized.match(/([\d.]+)\s*(B|KB|MB|GB|TB|PB)/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = units.indexOf(unit);
  if (!Number.isFinite(value) || index < 0) return 0;
  return Math.round(value * Math.pow(1024, index));
}

function extractFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractFirstHtml(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = cleanInlineText(match[1]);
      if (value) return value;
    }
  }
  return null;
}

function isLikelyUsername(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > 40) return false;
  const lower = normalized.toLowerCase();
  const blockedFragments = [
    'contact',
    'staff',
    'management',
    'logout',
    'powered by',
    'ban',
    'download',
    'warning',
    '管理组',
    '联系',
    '解除',
    '下载权',
    '用户详情',
  ];
  if (blockedFragments.some(fragment => lower.includes(fragment.toLowerCase()))) return false;
  if (/\s{2,}/.test(normalized)) return false;
  return true;
}

function isLikelyLevelName(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > 32) return false;
  const blockedFragments = ['down', 'ban', 'warning', 'contact', '管理', '解除', '下载权', '下调', '上调'];
  return !blockedFragments.some(fragment => normalized.toLowerCase().includes(fragment.toLowerCase()));
}

function makeAbsoluteUrl(baseUrl: string, path: string): string {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function buildRequestHeaders(cookie?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 PT RSS Monitor',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  if (cookie?.trim()) {
    headers.cookie = cookie.trim();
  }
  return headers;
}

function buildCookieHeaderFromMap(cookies?: Record<string, string>): string {
  if (!cookies || typeof cookies !== 'object') return '';
  return Object.entries(cookies)
    .filter(([name]) => !!name)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function detectNeedLogin(html: string, finalUrl: string): boolean {
  const lowerHtml = html.toLowerCase();
  const lowerUrl = finalUrl.toLowerCase();
  return (
    lowerUrl.includes('login') ||
    ((/login|signin|sign in|password|用户名|登录/.test(lowerHtml) || /login\.php|takelogin\.php/.test(lowerHtml)) &&
      /<form/i.test(html))
  );
}

function extractUserProfileLink(html: string, siteUrl: string): string | null {
  const patterns = [
    /href=["']([^"']*userdetails\.php\?id=\d+[^"']*)["']/i,
    /href=["']([^"']*user\.php\?id=\d+[^"']*)["']/i,
    /href=["']([^"']*\/users\/\d+[^"']*)["']/i,
    /href=["']([^"']*\/profile\/[^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return makeAbsoluteUrl(siteUrl, match[1]);
    }
  }

  return null;
}

function extractUserIdFromHtml(html: string): string | null {
  return extractFirst(html, [
    /userdetails\.php\?id=(\d+)/i,
    /user\.php\?id=(\d+)/i,
    /\/users\/(\d+)/i,
  ]);
}

function extractUsernameFromHtml(html: string, userId: string | null): string | null {
  const patterns: RegExp[] = [];

  if (userId) {
    patterns.push(
      new RegExp(`<a[^>]+href=["'][^"']*userdetails\\.php\\?id=${userId}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
      new RegExp(`<a[^>]+href=["'][^"']*user\\.php\\?id=${userId}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
      new RegExp(`<a[^>]+href=["'][^"']*\\/users\\/${userId}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
    );
  }

  patterns.push(
    /<title[^>]*>[\s\S]*?(?:用户详情|User\s*Details?)\s*-\s*([^<|-]+?)\s*-\s*Powered/i,
    /<a[^>]+class=["'][^"']*User_Name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    /<a[^>]+href=["'][^"']*(?:userdetails\.php|user\.php|\/users\/)[^"']*["'][^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/a>/i,
  );

  for (const pattern of patterns) {
    const value = extractFirstHtml(html, [pattern]);
    if (isLikelyUsername(value)) {
      return value;
    }
  }

  return null;
}

function extractLevelNameFromHtml(html: string, text: string): string | null {
  const classMatch = html.match(/class=['"]([A-Za-z]+)User_Name['"]/i);
  if (classMatch?.[1] && isLikelyLevelName(classMatch[1])) {
    return classMatch[1];
  }

  const textLevel = extractFirst(text, [
    /等级[:：]?\s*([^\s|/]+)/i,
    /用户等级[:：]?\s*([^\s|/]+)/i,
    /Class[:：]?\s*([^\s|/]+)/i,
    /Level[:：]?\s*([^\s|/]+)/i,
  ]);

  return isLikelyLevelName(textLevel) ? textLevel : null;
}

function parseRatio(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized === '-' || normalized === '--') return null;
  if (/^(?:∞|inf)$/i.test(normalized)) return Number.POSITIVE_INFINITY;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseUserInfoFromHtml(html: string) {
  const text = stripHtml(html);
  const userId = extractUserIdFromHtml(html);
  const fallbackUsername = extractFirst(text, [
    /用户名[:：]?\s*([^\s|/]+)/i,
    /用户(?:名)?[:：]?\s*([^\s|/]+)/i,
    /User(?:name)?[:：]?\s*([^\s|/]+)/i,
    /Welcome(?:\s+back)?\s+([^\s|/]+)/i,
  ]);
  const username = extractUsernameFromHtml(html, userId) || (isLikelyUsername(fallbackUsername) ? fallbackUsername : null);
  const levelName = extractLevelNameFromHtml(html, text);
  const uploadedRaw = extractFirst(text, [/上传量?[:：]?\s*([\d.,\sA-Z]+B)/i, /Uploaded[:：]?\s*([\d.,\sA-Z]+B)/i]);
  const downloadedRaw = extractFirst(text, [/下载量?[:：]?\s*([\d.,\sA-Z]+B)/i, /Downloaded[:：]?\s*([\d.,\sA-Z]+B)/i]);
  const bonusRaw = extractFirst(text, [/魔力(?:值|积分)?[:：]?\s*([\d.,]+)/i, /Bonus[:：]?\s*([\d.,]+)/i]);
  const ratioRaw = extractFirst(text, [/分享率[:：]?\s*([0-9.+-]+|∞|Inf|inf|--|-)/i, /Ratio[:：]?\s*([0-9.+-]+|∞|Inf|inf|--|-)/i]);
  const seedingRaw = extractFirst(text, [/做种(?:数)?[:：]?\s*(\d+)/i, /Seeding[:：]?\s*(\d+)/i]);
  const seedingSizeRaw = extractFirst(text, [/做种(?:量|体积)[:：]?\s*([\d.,\sA-Z]+B)/i, /Seeding Size[:：]?\s*([\d.,\sA-Z]+B)/i]);
  const uploadsRaw = extractFirst(text, [/发布(?:数)?[:：]?\s*(\d+)/i, /Uploads[:：]?\s*(\d+)/i]);
  const invitesRaw = extractFirst(text, [/邀请(?:数)?[:：]?\s*(\d+)/i, /Invites[:：]?\s*(\d+)/i]);
  const messageCountRaw = extractFirst(text, [/消息(?:数)?[:：]?\s*(\d+)/i, /Messages?[:：]?\s*(\d+)/i]);
  const joinTime = extractFirst(text, [/加入时间[:：]?\s*([0-9:\-\/\s]+)/i, /Joined[:：]?\s*([0-9:\-\/\s]+)/i]);
  const lastAccessAt = extractFirst(text, [/最近访问[:：]?\s*([0-9:\-\/\s]+)/i, /Last\s*access[:：]?\s*([0-9:\-\/\s]+)/i]);

  return {
    username,
    user_id: userId,
    level_name: levelName,
    uploaded: parseSizeToBytes(uploadedRaw),
    downloaded: parseSizeToBytes(downloadedRaw),
    ratio: parseRatio(ratioRaw),
    uploads: parseNumber(uploadsRaw),
    seeding: parseNumber(seedingRaw),
    seeding_size: parseSizeToBytes(seedingSizeRaw),
    bonus: bonusRaw ? parseNumber(bonusRaw.replace(/,/g, '')) : 0,
    invites: parseNumber(invitesRaw),
    message_count: parseNumber(messageCountRaw),
    join_time: joinTime || null,
    last_access_at: lastAccessAt || null,
  };
}

async function fetchHtml(url: string, cookie?: string) {
  const response = await fetch(url, {
    headers: buildRequestHeaders(cookie),
    redirect: 'follow',
  });
  const html = await response.text();
  return {
    ok: response.ok,
    html,
    finalUrl: response.url || url,
    url,
  };
}

async function refreshSiteUserData(siteId: number) {
  const site = db.getSite(siteId);
  if (!site) {
    return { status: 404 as const, body: { error: 'Site not found' } };
  }

  if (!site.site_url) {
    return { status: 400 as const, body: { error: 'Site URL not configured' } };
  }

  const cookie = site.cookie?.trim() || buildCookieHeaderFromMap(site.cookies);
  const homePage = await fetchHtml(site.site_url, cookie);

  if (!homePage.ok || detectNeedLogin(homePage.html, homePage.finalUrl)) {
    return {
      status: 200 as const,
      body: {
        success: false,
        need_login: true,
        site_url: site.site_url,
        error: cookie
          ? 'Cookie 已失效或当前站点未登录，请重新登录后更新站点 Cookie'
          : '当前架构无法直接读取浏览器第三方 Cookie，请先登录站点并把 Cookie 填入站点设置后再刷新',
      },
    };
  }

  const profileUrl = extractUserProfileLink(homePage.html, site.site_url);
  const profilePage = profileUrl && profileUrl !== homePage.finalUrl ? await fetchHtml(profileUrl, cookie) : null;
  const mergedHtml = [homePage.html, profilePage?.html].filter(Boolean).join('\n');
  const parsed = parseUserInfoFromHtml(mergedHtml);
  const existing = db.getUserDataBySiteId(siteId);

  const parsedFields = {
    username: !!parsed.username,
    user_id: !!parsed.user_id,
    uploaded: !!parsed.uploaded,
    downloaded: !!parsed.downloaded,
    ratio: parsed.ratio != null,
    level_name: !!parsed.level_name,
    seeding: !!parsed.seeding,
    bonus: !!parsed.bonus,
  };
  const parsedFieldCount = Object.values(parsedFields).filter(Boolean).length;

  const saved = db.upsertUserData(siteId, {
    ...parsed,
    username: parsed.username ?? existing?.username ?? null,
    user_id: parsed.user_id ?? existing?.user_id ?? null,
    level_name: parsed.level_name ?? existing?.level_name ?? null,
    status: parsedFieldCount >= 4 ? 'success' : parsedFieldCount > 0 ? 'warning' : 'error',
  });

  return {
    status: 200 as const,
    body: {
      success: parsedFieldCount > 0,
      need_login: false,
      site_url: site.site_url,
      data: saved,
      parsed_fields: parsedFields,
      profile_url: profileUrl,
      warning:
        parsedFieldCount === 0
          ? '未能识别当前站点的用户信息结构，需要补充站点专用解析规则'
          : parsedFieldCount < 4
            ? '只解析到部分字段，当前站点结构可能还需要专门适配'
            : undefined,
    },
  };
}

userData.get('/', (c) => {
  return c.json(db.allUserData());
});

userData.get('/:siteId/history', (c) => {
  const siteId = parseInt(c.req.param('siteId'), 10);
  const site = db.getSite(siteId);
  if (!site) {
    return c.json({ error: 'Site not found' }, 404);
  }
  return c.json(db.getUserDataHistoryBySiteId(siteId));
});

userData.put('/:siteId', async (c) => {
  const siteId = parseInt(c.req.param('siteId'), 10);
  const site = db.getSite(siteId);
  if (!site) {
    return c.json({ error: 'Site not found' }, 404);
  }

  const body = await c.req.json();
  const saved = db.upsertUserData(siteId, {
    username: body.username ?? null,
    user_id: body.user_id ?? null,
    level_name: body.level_name ?? null,
    uploaded: parseNumber(body.uploaded),
    downloaded: parseNumber(body.downloaded),
    ratio: body.ratio == null || body.ratio === '' ? null : parseNumber(body.ratio),
    true_uploaded: body.true_uploaded == null || body.true_uploaded === '' ? null : parseNumber(body.true_uploaded),
    true_downloaded: body.true_downloaded == null || body.true_downloaded === '' ? null : parseNumber(body.true_downloaded),
    true_ratio: body.true_ratio == null || body.true_ratio === '' ? null : parseNumber(body.true_ratio),
    uploads: parseNumber(body.uploads),
    seeding: parseNumber(body.seeding),
    seeding_size: parseNumber(body.seeding_size),
    bonus: parseNumber(body.bonus),
    bonus_per_hour: parseNumber(body.bonus_per_hour),
    invites: parseNumber(body.invites),
    join_time: body.join_time || null,
    last_access_at: body.last_access_at || null,
    message_count: parseNumber(body.message_count),
    status: typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'success',
    updated_at: body.updated_at || undefined,
  });

  return c.json(saved);
});

userData.post('/:siteId/refresh', async (c) => {
  const siteId = parseInt(c.req.param('siteId'), 10);

  if (!refreshQueue.has(siteId)) {
    refreshQueue.set(
      siteId,
      refreshSiteUserData(siteId).finally(() => {
        refreshQueue.delete(siteId);
      }),
    );
  }

  try {
    const result = await refreshQueue.get(siteId)!;
    return c.json(result.body, result.status);
  } catch (error) {
    const site = db.getSite(siteId);
    return c.json(
      {
        success: false,
        need_login: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
        site_url: site?.site_url,
      },
      500,
    );
  }
});

export default userData;
