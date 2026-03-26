import { Hono } from 'hono';
import db from '../db.js';

const userData = new Hono();
const refreshQueue = new Map<number, Promise<any>>();

type FetchResult = {
  ok: boolean;
  html: string;
  finalUrl: string;
  url: string;
  title: string;
};

type ParsedUserInfo = {
  username: string | null;
  user_id: string | null;
  level_name: string | null;
  uploaded: number;
  downloaded: number;
  ratio: number | null;
  uploads: number;
  seeding: number;
  seeding_size: number;
  bonus: number;
  invites: number;
  message_count: number;
  join_time: string | null;
  last_access_at: string | null;
};

type SiteKind = 'nexusphp' | 'generic';

const FIELD_LABELS = {
  uploaded: ['上传量', '上传', 'Uploaded'],
  downloaded: ['下载量', '下载', 'Downloaded'],
  ratio: ['分享率', 'Ratio'],
  bonus: ['魔力值', '魔力', '积分', 'Bonus'],
  seeding: ['做种数', '做种', 'Seeding'],
  seedingSize: ['做种体积', '做种量', 'Seeding Size'],
  uploads: ['发布数', 'Uploads'],
  invites: ['邀请数', '邀请', 'Invites'],
  messageCount: ['消息数', '未读消息', 'Messages', 'Inbox'],
  joinTime: ['加入时间', '注册时间', 'Joined', 'Join Date'],
  lastAccessAt: ['最近访问', '最后访问', 'Last access', 'Last seen'],
  levelName: ['等级', '用户等级', 'Class', 'Level'],
  username: ['用户名', 'User', 'Username'],
} as const;

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

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanInlineText(match?.[1] || '');
}

function extractCharset(headersCharset: string | null, html: string): string {
  if (headersCharset) return headersCharset.toLowerCase();
  const metaMatch =
    html.match(/<meta[^>]+charset=["']?([\w-]+)/i) ||
    html.match(/<meta[^>]+content=["'][^"']*charset=([\w-]+)/i);
  return (metaMatch?.[1] || 'utf-8').toLowerCase();
}

function normalizeCharset(charset: string): string {
  if (charset === 'gbk' || charset === 'gb2312') return 'gb18030';
  if (charset === 'utf8') return 'utf-8';
  return charset;
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
    if (match?.[1]) return cleanInlineText(match[1]);
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
    '管理员',
    '联系',
    '解除',
    '下载权',
    '用户详情',
    '登录',
  ];
  if (blockedFragments.some((fragment) => lower.includes(fragment.toLowerCase()))) return false;
  if (/\s{2,}/.test(normalized)) return false;
  return true;
}

function isLikelyLevelName(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized || normalized.length > 32) return false;
  const blockedFragments = ['down', 'ban', 'warning', 'contact', '管理员', '解除', '下载权', '登录'];
  return !blockedFragments.some((fragment) => normalized.toLowerCase().includes(fragment.toLowerCase()));
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

function detectNeedLogin(html: string, finalUrl: string, title: string): boolean {
  const lowerHtml = html.toLowerCase();
  const lowerUrl = finalUrl.toLowerCase();
  const lowerTitle = title.toLowerCase();
  return (
    lowerUrl.includes('login') ||
    lowerTitle.includes('登录') ||
    lowerTitle.includes('login') ||
    ((/login|signin|sign in|password|登录|登入/.test(lowerHtml) || /login\.php|takelogin\.php/.test(lowerHtml)) &&
      /<form/i.test(html))
  );
}

function detectSiteKind(html: string, finalUrl: string, title: string): SiteKind {
  const lowerHtml = html.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerUrl = finalUrl.toLowerCase();
  if (
    lowerHtml.includes('nexusphp') ||
    lowerTitle.includes('powered by nexusphp') ||
    lowerUrl.includes('userdetails.php') ||
    lowerHtml.includes('userdetails.php')
  ) {
    return 'nexusphp';
  }
  return 'generic';
}

function extractUserIdFromHtml(html: string, finalUrl = ''): string | null {
  return (
    extractFirst(`${finalUrl}\n${html}`, [
      /userdetails\.php\?id=(\d+)/i,
      /user\.php\?id=(\d+)/i,
      /\/users\/(\d+)/i,
      /\/profile\/(\d+)/i,
    ]) || null
  );
}

function extractUserProfileLink(html: string, siteUrl: string): string | null {
  const patterns = [
    /href=["']([^"']*userdetails\.php\?id=\d+[^"']*)["']/i,
    /href=["']([^"']*user\.php\?id=\d+[^"']*)["']/i,
    /href=["']([^"']*\/users\/\d+[^"']*)["']/i,
    /href=["']([^"']*\/profile\/\d+[^"']*)["']/i,
    /href=["']([^"']*\/profile\/[^"'/]+[^"']*)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return makeAbsoluteUrl(siteUrl, match[1]);
    }
  }

  return null;
}

function collectCandidateUrls(siteUrl: string, kind: SiteKind, homeHtml: string, homeFinalUrl: string): string[] {
  const urls = new Set<string>([homeFinalUrl || siteUrl]);
  const userId = extractUserIdFromHtml(homeHtml, homeFinalUrl);
  const profileUrl = extractUserProfileLink(homeHtml, siteUrl);

  if (profileUrl) urls.add(profileUrl);

  if (kind === 'nexusphp') {
    urls.add(makeAbsoluteUrl(siteUrl, '/index.php'));
    urls.add(makeAbsoluteUrl(siteUrl, '/my.php'));
    urls.add(makeAbsoluteUrl(siteUrl, '/messages.php'));
    urls.add(makeAbsoluteUrl(siteUrl, '/mybonus.php'));
    if (userId) {
      urls.add(makeAbsoluteUrl(siteUrl, `/userdetails.php?id=${userId}`));
    }
  } else {
    urls.add(makeAbsoluteUrl(siteUrl, '/profile'));
    urls.add(makeAbsoluteUrl(siteUrl, '/user.php'));
    urls.add(makeAbsoluteUrl(siteUrl, '/my.php'));
  }

  return [...urls];
}

function extractTableField(html: string, labels: readonly string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<td[^>]*>\\s*${escaped}\\s*(?:[:：])?\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i'),
      new RegExp(`<th[^>]*>\\s*${escaped}\\s*(?:[:：])?\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i'),
      new RegExp(`${escaped}\\s*(?:[:：])\\s*([^<\\n]+)`, 'i'),
    ];
    const value = extractFirstHtml(html, patterns);
    if (value) return value;
  }
  return null;
}

function extractUsernameFromHtml(html: string, userId: string | null, title: string): string | null {
  const patterns: RegExp[] = [];

  if (userId) {
    patterns.push(
      new RegExp(`<a[^>]+href=["'][^"']*userdetails\\.php\\?id=${userId}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
      new RegExp(`<a[^>]+href=["'][^"']*user\\.php\\?id=${userId}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
      new RegExp(`<a[^>]+href=["'][^"']*\\/users\\/${userId}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
    );
  }

  patterns.push(
    /<a[^>]+class=["'][^"']*User_Name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    /<a[^>]+href=["'][^"']*(?:userdetails\.php|user\.php|\/users\/|\/profile\/)[^"']*["'][^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/a>/i,
    /<a[^>]+href=["'][^"']*(?:userdetails\.php|user\.php|\/users\/|\/profile\/)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
  );

  for (const pattern of patterns) {
    const value = extractFirstHtml(html, [pattern]);
    if (isLikelyUsername(value)) {
      return value;
    }
  }

  const titleCandidates = [
    title.match(/用户详情\s*[-:：]\s*([^-|]+)/i)?.[1],
    title.match(/User\s*Details?\s*[-:：]\s*([^-|]+)/i)?.[1],
    title.match(/^([^-|]+)\s*::\s*用户详情/i)?.[1],
    title.match(/^([^-|]+)\s*::\s*User\s*Details/i)?.[1],
  ]
    .map((value) => cleanInlineText(value || ''))
    .filter(Boolean);

  for (const candidate of titleCandidates) {
    if (isLikelyUsername(candidate)) return candidate;
  }

  const tableUsername = extractTableField(html, FIELD_LABELS.username);
  return isLikelyUsername(tableUsername) ? tableUsername : null;
}

function extractLevelNameFromHtml(html: string): string | null {
  const classMatch = html.match(/class=['"]([A-Za-z]+)User_Name['"]/i);
  if (classMatch?.[1] && isLikelyLevelName(classMatch[1])) {
    return classMatch[1];
  }

  const tableLevel = extractTableField(html, FIELD_LABELS.levelName);
  return isLikelyLevelName(tableLevel) ? tableLevel : null;
}

function parseRatio(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized === '-' || normalized === '--') return null;
  if (/^(?:∞|inf)$/i.test(normalized)) return Number.POSITIVE_INFINITY;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseUserInfoFromHtml(html: string, finalUrl: string): ParsedUserInfo {
  const text = stripHtml(html);
  const title = extractTitle(html);
  const userId = extractUserIdFromHtml(html, finalUrl);
  const fallbackUsername = extractFirst(text, [
    /用户名\s*[:：]?\s*([^\s|/]+)/i,
    /User(?:name)?\s*[:：]?\s*([^\s|/]+)/i,
    /Welcome(?:\s+back)?\s+([^\s|/]+)/i,
  ]);
  const username = extractUsernameFromHtml(html, userId, title) || (isLikelyUsername(fallbackUsername) ? fallbackUsername : null);
  const levelName = extractLevelNameFromHtml(html);
  const uploadedRaw =
    extractTableField(html, FIELD_LABELS.uploaded) || extractFirst(text, [/Uploaded\s*[:：]?\s*([\d.,\sA-Z]+B)/i]);
  const downloadedRaw =
    extractTableField(html, FIELD_LABELS.downloaded) || extractFirst(text, [/Downloaded\s*[:：]?\s*([\d.,\sA-Z]+B)/i]);
  const bonusRaw = extractTableField(html, FIELD_LABELS.bonus) || extractFirst(text, [/Bonus\s*[:：]?\s*([\d.,]+)/i]);
  const ratioRaw = extractTableField(html, FIELD_LABELS.ratio) || extractFirst(text, [/Ratio\s*[:：]?\s*([0-9.+-]+|∞|inf|--|-)/i]);
  const seedingRaw = extractTableField(html, FIELD_LABELS.seeding) || extractFirst(text, [/Seeding\s*[:：]?\s*(\d+)/i]);
  const seedingSizeRaw =
    extractTableField(html, FIELD_LABELS.seedingSize) || extractFirst(text, [/Seeding Size\s*[:：]?\s*([\d.,\sA-Z]+B)/i]);
  const uploadsRaw = extractTableField(html, FIELD_LABELS.uploads) || extractFirst(text, [/Uploads\s*[:：]?\s*(\d+)/i]);
  const invitesRaw = extractTableField(html, FIELD_LABELS.invites) || extractFirst(text, [/Invites\s*[:：]?\s*(\d+)/i]);
  const messageCountRaw =
    extractTableField(html, FIELD_LABELS.messageCount) || extractFirst(text, [/Messages?\s*[:：]?\s*(\d+)/i]);
  const joinTime =
    extractTableField(html, FIELD_LABELS.joinTime) || extractFirst(text, [/Joined\s*[:：]?\s*([0-9:\-\/\s]+)/i]);
  const lastAccessAt =
    extractTableField(html, FIELD_LABELS.lastAccessAt) || extractFirst(text, [/Last\s*access\s*[:：]?\s*([0-9:\-\/\s]+)/i]);

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
    bonus: bonusRaw ? parseNumber(String(bonusRaw).replace(/,/g, '')) : 0,
    invites: parseNumber(invitesRaw),
    message_count: parseNumber(messageCountRaw),
    join_time: joinTime || null,
    last_access_at: lastAccessAt || null,
  };
}

async function fetchHtml(url: string, cookie?: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: buildRequestHeaders(cookie),
    redirect: 'follow',
  });

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const utf8Preview = new TextDecoder('utf-8').decode(bytes);
  const headerCharset = response.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1] || null;
  const charset = normalizeCharset(extractCharset(headerCharset, utf8Preview));
  let html = utf8Preview;

  try {
    html = new TextDecoder(charset).decode(bytes);
  } catch {
    html = utf8Preview;
  }

  return {
    ok: response.ok,
    html,
    finalUrl: response.url || url,
    url,
    title: extractTitle(html),
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

  if (!homePage.ok || detectNeedLogin(homePage.html, homePage.finalUrl, homePage.title)) {
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

  const siteKind = detectSiteKind(homePage.html, homePage.finalUrl, homePage.title);
  const candidateUrls = collectCandidateUrls(site.site_url, siteKind, homePage.html, homePage.finalUrl);
  const pages = new Map<string, FetchResult>();
  pages.set(homePage.finalUrl, homePage);

  for (const candidateUrl of candidateUrls) {
    if (pages.has(candidateUrl)) continue;
    try {
      const page = await fetchHtml(candidateUrl, cookie);
      if (!detectNeedLogin(page.html, page.finalUrl, page.title)) {
        pages.set(candidateUrl, page);
      }
    } catch {
      continue;
    }
  }

  let bestParsed: ParsedUserInfo | null = null;
  let bestFieldCount = -1;
  let bestPageUrl: string | null = null;

  for (const page of pages.values()) {
    const parsed = parseUserInfoFromHtml(page.html, page.finalUrl);
    const fieldCount = [
      !!parsed.username,
      !!parsed.user_id,
      !!parsed.level_name,
      parsed.uploaded > 0,
      parsed.downloaded > 0,
      parsed.ratio != null,
      parsed.seeding > 0,
      parsed.bonus > 0,
      parsed.message_count > 0,
    ].filter(Boolean).length;

    if (fieldCount > bestFieldCount) {
      bestParsed = parsed;
      bestFieldCount = fieldCount;
      bestPageUrl = page.finalUrl;
    }
  }

  const parsed = bestParsed || {
    username: null,
    user_id: null,
    level_name: null,
    uploaded: 0,
    downloaded: 0,
    ratio: null,
    uploads: 0,
    seeding: 0,
    seeding_size: 0,
    bonus: 0,
    invites: 0,
    message_count: 0,
    join_time: null,
    last_access_at: null,
  };

  const existing = db.getUserDataBySiteId(siteId);
  const parsedFields = {
    username: !!parsed.username,
    user_id: !!parsed.user_id,
    uploaded: parsed.uploaded > 0,
    downloaded: parsed.downloaded > 0,
    ratio: parsed.ratio != null,
    level_name: !!parsed.level_name,
    seeding: parsed.seeding > 0,
    bonus: parsed.bonus > 0,
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
      site_kind: siteKind,
      profile_url: bestPageUrl,
      checked_pages: [...pages.values()].map((page) => ({ url: page.finalUrl, title: page.title })),
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
