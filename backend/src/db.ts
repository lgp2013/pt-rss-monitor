import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createHash, randomBytes } from 'crypto';

interface Source {
  id: number;
  name: string;
  url: string;
  category: string;
  fetch_interval: number;
  enabled: number;
  created_at: string;
}

interface Site {
  id: number;
  name: string;
  site_url: string;
  category: string;
  enabled: number;
  created_at: string;
  cookie?: string;
  cookies?: Record<string, string>;
  cookie_updated_at?: string | null;
  cookie_sync_mode?: string | null;
  groups?: string[];
  is_offline?: number;
  allow_search?: number;
  allow_query_user_info?: number;
  allow_content_script?: number;
  custom_name?: string | null;
  timezone_offset?: string | null;
  passkey?: string | null;
  download_link_appendix?: string | null;
  request_timeout?: number;
  download_interval?: number;
  upload_speed_limit?: number;
}

interface Resource {
  id: number;
  source_id: number;
  title: string;
  translated_name?: string | null;
  link: string;
  guid: string | null;
  pub_date: string | null;
  seeders: number;
  leechers: number;
  downloads: number;
  free_tag: string | null;
  size: string | null;
  created_at: string;
  subtitle?: string | null;
  poster_url?: string | null;
  category?: string | null;
  description?: string | null;
  description_html?: string | null;
}

interface Setting {
  key: string;
  value: string;
}

interface User {
  id: number;
  username: string;
  password_hash: string;
  is_system: number;
  created_at: string;
  updated_at: string;
}

interface AuthSession {
  token: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

interface UserData {
  id: number;
  site_id: number;
  username: string | null;
  user_id: string | null;
  level_name: string | null;
  uploaded: number;
  downloaded: number;
  ratio: number | null;
  true_uploaded: number | null;
  true_downloaded: number | null;
  true_ratio: number | null;
  uploads: number;
  seeding: number;
  seeding_size: number;
  bonus: number;
  bonus_per_hour: number;
  invites: number;
  join_time: string | null;
  last_access_at: string | null;
  message_count: number;
  status: string;
  updated_at: string;
}

interface UserDataHistory extends UserData {
  history_id: number;
  snapshot_at: string;
}

interface DatabaseState {
  sources: Source[];
  sites: Site[];
  resources: Resource[];
  settings: Setting[];
  users: User[];
  authSessions: AuthSession[];
  userData: UserData[];
  userDataHistory: UserDataHistory[];
  sourceIdCounter: number;
  siteIdCounter: number;
  resourceIdCounter: number;
  userIdCounter: number;
  userDataIdCounter: number;
  userDataHistoryIdCounter: number;
}

const DEFAULT_SITE_VALUES = {
  groups: [] as string[],
  is_offline: 0,
  allow_search: 1,
  allow_query_user_info: 1,
  allow_content_script: 1,
  custom_name: null as string | null,
  timezone_offset: '+0800' as string | null,
  passkey: null as string | null,
  download_link_appendix: null as string | null,
  request_timeout: 30000,
  download_interval: 0,
  upload_speed_limit: 0,
  cookie_updated_at: null as string | null,
  cookie_sync_mode: null as string | null,
};

function normalizeSite(site: Site): Site {
  return {
    ...DEFAULT_SITE_VALUES,
    ...site,
    groups: Array.isArray(site.groups) ? site.groups : [],
    is_offline: Number(site.is_offline ?? 0),
    allow_search: Number(site.allow_search ?? 1),
    allow_query_user_info: Number(site.allow_query_user_info ?? 1),
    allow_content_script: Number(site.allow_content_script ?? 1),
    request_timeout: Number(site.request_timeout ?? 30000),
    download_interval: Number(site.download_interval ?? 0),
    upload_speed_limit: Number(site.upload_speed_limit ?? 0),
    cookie_updated_at: site.cookie_updated_at ?? null,
    cookie_sync_mode: site.cookie_sync_mode ?? null,
  };
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

function extractHostname(value: string): string {
  try {
    return normalizeHostname(new URL(value).hostname);
  } catch {
    return normalizeHostname(value);
  }
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractTranslatedName(description?: string | null): string | null {
  if (!description) return null;
  const normalized = description
    .replace(/\u3000/g, ' ')
    .replace(/[：:]/g, ' ')
    .replace(/[ \t]+/g, ' ');
  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cleanedLine = line
      .replace(/^◎\s*/, '')
      .replace(/^â\s*/, '')
      .trim();
    const match = cleanedLine.match(/^(?:译\s*名|è¯\s*å)\s+(.+)$/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function normalizeResource(resource: Resource): Resource {
  return {
    ...resource,
    translated_name: resource.translated_name ?? extractTranslatedName(resource.description) ?? null,
  };
}

function hasValidSiteId(value: unknown, sites: Site[]): value is number {
  return typeof value === 'number' && sites.some(site => site.id === value);
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

class InMemoryDB {
  private sources: Source[] = [];
  private sites: Site[] = [];
  private resources: Resource[] = [];
  private settings: Setting[] = [];
  private users: User[] = [];
  private authSessions: AuthSession[] = [];
  private userData: UserData[] = [];
  private userDataHistory: UserDataHistory[] = [];
  private sourceIdCounter = 1;
  private siteIdCounter = 1;
  private resourceIdCounter = 1;
  private userIdCounter = 1;
  private userDataIdCounter = 1;
  private userDataHistoryIdCounter = 1;
  private dbPath: string;

  constructor() {
    const dbPathEnv = process.env.DB_PATH;
    if (dbPathEnv) {
      this.dbPath = dbPathEnv;
    } else {
      const dataDir = resolve(process.cwd(), './data');
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      this.dbPath = resolve(dataDir, 'pt-rss-monitor.json');
    }
    this.loadData();
    const defaults = [
      { key: 'global_fetch_interval', value: '30' },
      { key: 'auto_fetch_enabled', value: 'true' },
      { key: 'theme', value: 'system' },
      { key: 'resources_retention_days', value: '30' },
      { key: 'extension_sync_key', value: randomBytes(24).toString('hex') },
    ];
    for (const setting of defaults) {
      if (!this.settings.some(s => s.key === setting.key)) this.settings.push(setting);
    }
    this.ensureDefaultAdmin();
    this.saveData();
  }

  allSources(): Source[] {
    return this.sources;
  }
  getSource(id: number): Source | undefined {
    return this.sources.find(s => s.id === id);
  }
  addSource(source: Omit<Source, 'id' | 'created_at'>): Source {
    const newSource: Source = { ...source, id: this.sourceIdCounter++, created_at: new Date().toISOString() };
    this.sources.push(newSource);
    this.saveData();
    return newSource;
  }
  updateSource(id: number, updates: Partial<Source>): Source | undefined {
    const index = this.sources.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.sources[index] = { ...this.sources[index], ...updates };
    this.saveData();
    return this.sources[index];
  }
  deleteSource(id: number): boolean {
    const initialLength = this.sources.length;
    this.sources = this.sources.filter(s => s.id !== id);
    this.resources = this.resources.filter(r => r.source_id !== id);
    this.saveData();
    return this.sources.length < initialLength;
  }

  allSites(): Site[] {
    return this.sites.map(normalizeSite);
  }
  getSite(id: number): Site | undefined {
    const site = this.sites.find(s => s.id === id);
    return site ? normalizeSite(site) : undefined;
  }
  findSiteByUrl(url: string): Site | undefined {
    const targetHost = extractHostname(url);
    if (!targetHost) return undefined;

    const matched = this.sites.find(site => {
      const siteHost = extractHostname(site.site_url);
      if (!siteHost) return false;
      return targetHost === siteHost || targetHost.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${targetHost}`);
    });

    return matched ? normalizeSite(matched) : undefined;
  }
  addSite(site: Omit<Site, 'id' | 'created_at'>): Site {
    const newSite = normalizeSite({ ...site, id: this.siteIdCounter++, created_at: new Date().toISOString() });
    this.sites.push(newSite);
    this.saveData();
    return newSite;
  }
  updateSite(id: number, updates: Partial<Site>): Site | undefined {
    const index = this.sites.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.sites[index] = normalizeSite({ ...this.sites[index], ...updates });
    this.saveData();
    return this.sites[index];
  }
  deleteSite(id: number): boolean {
    const initialLength = this.sites.length;
    this.sites = this.sites.filter(s => s.id !== id);
    this.userData = this.userData.filter(item => item.site_id !== id);
    this.userDataHistory = this.userDataHistory.filter(item => item.site_id !== id);
    this.saveData();
    return this.sites.length < initialLength;
  }

  allResources(): Resource[] {
    return this.resources.map(normalizeResource);
  }
  getResource(id: number): Resource | undefined {
    const resource = this.resources.find(r => r.id === id);
    return resource ? normalizeResource(resource) : undefined;
  }
  addResource(resource: Omit<Resource, 'id' | 'created_at'>): Resource {
    const newResource: Resource = normalizeResource({
      ...resource,
      id: this.resourceIdCounter++,
      created_at: new Date().toISOString(),
    });
    this.resources.push(newResource);
    this.saveData();
    return newResource;
  }
  updateResource(id: number, updates: Partial<Resource>): Resource | undefined {
    const index = this.resources.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    this.resources[index] = normalizeResource({ ...this.resources[index], ...updates });
    this.saveData();
    return this.resources[index];
  }
  deleteResource(id: number): boolean {
    const initialLength = this.resources.length;
    this.resources = this.resources.filter(r => r.id !== id);
    this.saveData();
    return this.resources.length < initialLength;
  }
  deleteResourcesBySourceId(sourceId: number): number {
    const initialLength = this.resources.length;
    this.resources = this.resources.filter(r => r.source_id !== sourceId);
    this.saveData();
    return initialLength - this.resources.length;
  }

  allSettings(): Setting[] {
    return this.settings;
  }
  getSetting(key: string): Setting | undefined {
    return this.settings.find(s => s.key === key);
  }
  updateSetting(key: string, value: string): Setting {
    const index = this.settings.findIndex(s => s.key === key);
    if (index === -1) this.settings.push({ key, value });
    else this.settings[index].value = value;
    this.saveData();
    return this.settings.find(s => s.key === key) as Setting;
  }
  getOrCreateExtensionSyncKey(): string {
    const existing = this.getSetting('extension_sync_key')?.value?.trim();
    if (existing) return existing;
    return this.updateSetting('extension_sync_key', randomBytes(24).toString('hex')).value;
  }
  regenerateExtensionSyncKey(): string {
    return this.updateSetting('extension_sync_key', randomBytes(24).toString('hex')).value;
  }

  allUsers(): User[] {
    return this.users;
  }
  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }
  getUserByUsername(username: string): User | undefined {
    return this.users.find(user => user.username.toLowerCase() === username.trim().toLowerCase());
  }
  createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): User {
    const now = new Date().toISOString();
    const newUser: User = {
      ...user,
      id: this.userIdCounter++,
      created_at: now,
      updated_at: now,
    };
    this.users.push(newUser);
    this.saveData();
    return newUser;
  }
  updateUser(id: number, updates: Partial<Omit<User, 'id' | 'created_at'>>): User | undefined {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return undefined;
    this.users[index] = {
      ...this.users[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveData();
    return this.users[index];
  }
  verifyPassword(user: User, password: string): boolean {
    return user.password_hash === hashPassword(password);
  }
  createAuthSession(userId: number, expiresInHours = 24 * 7): AuthSession {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + expiresInHours * 60 * 60 * 1000);
    const session: AuthSession = {
      token: randomBytes(32).toString('hex'),
      user_id: userId,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    this.authSessions = this.authSessions.filter(item => item.user_id !== userId);
    this.authSessions.push(session);
    this.saveData();
    return session;
  }
  getAuthSession(token: string): AuthSession | undefined {
    const now = Date.now();
    const session = this.authSessions.find(item => item.token === token);
    if (!session) return undefined;
    if (new Date(session.expires_at).getTime() <= now) {
      this.deleteAuthSession(token);
      return undefined;
    }
    return session;
  }
  deleteAuthSession(token: string): boolean {
    const initialLength = this.authSessions.length;
    this.authSessions = this.authSessions.filter(item => item.token !== token);
    if (this.authSessions.length !== initialLength) {
      this.saveData();
      return true;
    }
    return false;
  }
  deleteAuthSessionsByUserId(userId: number): number {
    const initialLength = this.authSessions.length;
    this.authSessions = this.authSessions.filter(item => item.user_id !== userId);
    const deleted = initialLength - this.authSessions.length;
    if (deleted > 0) this.saveData();
    return deleted;
  }

  allUserData(): Array<UserData & { site_name: string; site_category: string; site_enabled: number; site_url: string }> {
    return this.userData.map(item => {
      const site = this.getSite(item.site_id);
      return {
        ...item,
        site_name: site?.custom_name || site?.name || '',
        site_category: site?.category || '',
        site_enabled: site?.enabled || 0,
        site_url: site?.site_url || '',
      };
    });
  }
  getUserDataBySiteId(siteId: number): UserData | undefined {
    return this.userData.find(item => item.site_id === siteId);
  }
  upsertUserData(
    siteId: number,
    payload: Partial<Omit<UserData, 'id' | 'site_id' | 'updated_at'>> & { updated_at?: string },
  ): UserData {
    const existingIndex = this.userData.findIndex(item => item.site_id === siteId);
    const now = payload.updated_at || new Date().toISOString();
    const base: UserData = {
      id: existingIndex >= 0 ? this.userData[existingIndex].id : this.userDataIdCounter++,
      site_id: siteId,
      username: payload.username ?? null,
      user_id: payload.user_id ?? null,
      level_name: payload.level_name ?? null,
      uploaded: normalizeNumber(payload.uploaded, 0),
      downloaded: normalizeNumber(payload.downloaded, 0),
      ratio: payload.ratio == null ? null : normalizeNumber(payload.ratio, 0),
      true_uploaded: payload.true_uploaded == null ? null : normalizeNumber(payload.true_uploaded, 0),
      true_downloaded: payload.true_downloaded == null ? null : normalizeNumber(payload.true_downloaded, 0),
      true_ratio: payload.true_ratio == null ? null : normalizeNumber(payload.true_ratio, 0),
      uploads: normalizeNumber(payload.uploads, 0),
      seeding: normalizeNumber(payload.seeding, 0),
      seeding_size: normalizeNumber(payload.seeding_size, 0),
      bonus: normalizeNumber(payload.bonus, 0),
      bonus_per_hour: normalizeNumber(payload.bonus_per_hour, 0),
      invites: normalizeNumber(payload.invites, 0),
      join_time: payload.join_time ?? null,
      last_access_at: payload.last_access_at ?? null,
      message_count: normalizeNumber(payload.message_count, 0),
      status: payload.status ?? 'success',
      updated_at: now,
    };
    if (existingIndex >= 0) this.userData[existingIndex] = base;
    else this.userData.push(base);
    this.userDataHistory.push({ ...base, history_id: this.userDataHistoryIdCounter++, snapshot_at: now });
    this.saveData();
    return base;
  }
  getUserDataHistoryBySiteId(siteId: number): UserDataHistory[] {
    return this.userDataHistory
      .filter(item => item.site_id === siteId)
      .sort((a, b) => new Date(b.snapshot_at).getTime() - new Date(a.snapshot_at).getTime());
  }

  exec(_sql: string): void {}
  prepare(sql: string): any {
    return {
      all: (...params: any[]) => {
        if (sql.includes('SELECT r.')) {
          let results = this.resources.map(r => {
            const src = this.sources.find(s => s.id === r.source_id);
            return { ...r, source_name: src?.name || '', category: r.category || src?.category || '' };
          });
          const hasSourceIdFilter = sql.includes('r.source_id = ?');
          const hasCategoryFilter = sql.includes('s.category = ?');
          const hasSearchFilter = sql.includes('title LIKE ?');
          const hasFreeTagFilter = sql.includes('r.free_tag = ?');
          const titleLikeCount = (sql.match(/r\.title LIKE \?/g) || []).length;
          let paramIdx = 0;
          if (hasSourceIdFilter && params[paramIdx] != null) {
            const sid = Number(params[paramIdx]);
            results = results.filter(r => r.source_id === sid);
            paramIdx++;
          }
          if (hasCategoryFilter && params[paramIdx] != null) {
            const category = String(params[paramIdx]);
            results = results.filter(r => r.category === category);
            paramIdx++;
          }
          if (hasSearchFilter && titleLikeCount > 0) {
            for (let index = 0; index < titleLikeCount; index++) {
              const search = String(params[paramIdx]).replace(/%/g, '').toLowerCase();
              results = results.filter(r => r.title.toLowerCase().includes(search));
              paramIdx++;
            }
          }
          if (hasFreeTagFilter && params[paramIdx] != null) {
            const freeTag = String(params[paramIdx]).toLowerCase();
            results = results.filter(r => (r.free_tag || '').toLowerCase() === freeTag);
          }
          const sortMatch = sql.match(/ORDER BY r\.(\w+)\s+(ASC|DESC)/i);
          if (sortMatch) {
            const col = sortMatch[1] as keyof typeof results[0];
            const asc = sortMatch[2].toLowerCase() === 'asc';
            results.sort((a, b) => {
              const aVal = a[col];
              const bVal = b[col];
              if (aVal == null && bVal == null) return 0;
              if (aVal == null) return asc ? 1 : -1;
              if (bVal == null) return asc ? -1 : 1;
              if (typeof aVal === 'string' && typeof bVal === 'string') return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
              return asc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
            });
          }
          if (params.length >= 2) {
            const limit = Number(params[params.length - 2]);
            const offset = Number(params[params.length - 1]);
            results = results.slice(offset, offset + limit);
          }
          return results;
        }
        if (sql.includes('SELECT * FROM sources WHERE enabled = 1')) return this.sources.filter(source => source.enabled === 1);
        if (sql.includes('SELECT * FROM sources')) return this.sources;
        if (sql.includes('SELECT id, category FROM sources')) {
          return this.sources.map(source => ({ id: source.id, category: source.category }));
        }
        if (sql.includes('SELECT category FROM sources')) {
          return this.sources.map(source => ({ category: source.category }));
        }
        if (sql.includes('SELECT * FROM sites')) return this.sites.map(normalizeSite);
        if (sql.includes('SELECT * FROM resources')) return this.resources;
        if (sql.includes('SELECT * FROM settings')) return this.settings;
        return [];
      },
      get: (...params: any[]) => {
        if (sql.includes("SELECT value FROM settings WHERE key =")) return { value: this.getSetting(params[0])?.value };
        if (sql.includes('SELECT * FROM settings WHERE key =')) return this.getSetting(params[0]);
        if (sql.includes('SELECT * FROM sources WHERE id =')) return this.getSource(params[0]);
        if (sql.includes('SELECT * FROM resources WHERE id =')) return this.getResource(params[0]);
        if (sql.includes('SELECT id FROM resources WHERE source_id = ? AND (guid = ? OR link = ?)')) {
          const [sourceId, guid, link] = params;
          const existing = this.resources.find(r => r.source_id === sourceId && (r.guid === guid || r.link === link));
          return existing ? { id: existing.id } : null;
        }
        if (sql.includes('SELECT COUNT(*) as total')) {
          if (sql.includes('FROM resources')) {
            let filtered = this.resources;
            let paramIdx = 0;
            if (sql.includes('r.source_id = ?') && params[paramIdx] != null) {
              const sourceId = Number(params[paramIdx]);
              filtered = filtered.filter(r => r.source_id === sourceId);
              paramIdx++;
            }
            if (sql.includes('s.category = ?') && params[paramIdx] != null) {
              const category = String(params[paramIdx]);
              filtered = filtered.filter(r => {
                const source = this.sources.find(s => s.id === r.source_id);
                return source?.category === category;
              });
              paramIdx++;
            }
            const titleLikeCount = (sql.match(/r\.title LIKE \?/g) || []).length;
            for (let index = 0; index < titleLikeCount; index++) {
              const search = String(params[paramIdx] ?? '').replace(/%/g, '').toLowerCase();
              filtered = filtered.filter(r => r.title.toLowerCase().includes(search));
              paramIdx++;
            }
            if (sql.includes('r.free_tag = ?') && params[paramIdx] != null) {
              const freeTag = String(params[paramIdx]).toLowerCase();
              filtered = filtered.filter(r => (r.free_tag || '').toLowerCase() === freeTag);
            }
            return { total: filtered.length };
          }
          if (sql.includes('FROM sources')) return { total: this.sources.length };
          return { total: 0 };
        }
        if (sql.includes('SELECT COUNT(*) as count')) {
          if (sql.includes('FROM sources')) return { count: this.sources.length };
          if (sql.includes('FROM sites')) return { count: this.sites.length };
          if (sql.includes('FROM resources')) {
            if (sql.includes('created_at >=')) {
              const date = new Date(params[0]);
              return { count: this.resources.filter(r => new Date(r.created_at) >= date).length };
            }
            return { count: this.resources.length };
          }
          return { count: 0 };
        }
        return null;
      },
      run: (...params: any[]) => {
        if (sql.includes('INSERT INTO sources')) {
          const [name, url, category, fetch_interval, enabled] = params;
          this.addSource({ name, url, category, fetch_interval, enabled });
          return { lastInsertRowid: this.sourceIdCounter - 1 };
        }
        if (sql.includes('INSERT INTO settings')) {
          const [key, value] = params;
          this.updateSetting(key, value);
          return { lastInsertRowid: 0 };
        }
        if (sql.includes('UPDATE sources')) {
          if (sql.includes('SET created_at = created_at WHERE id = ?')) {
            return { changes: this.getSource(params[0]) ? 1 : 0 };
          }
          const [name, url, category, fetch_interval, enabled, id] = params;
          this.updateSource(id, { name, url, category, fetch_interval, enabled });
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM sources')) {
          const [id] = params;
          return { changes: this.deleteSource(id) ? 1 : 0 };
        }
        if (sql.includes('INSERT INTO resources')) {
          const [source_id, title, translated_name, link, guid, pub_date, seeders, leechers, downloads, free_tag, size, subtitle, poster_url, category, description, description_html] = params;
          this.addResource({ source_id, title, translated_name, link, guid, pub_date, seeders, leechers, downloads, free_tag, size, subtitle, poster_url, category, description, description_html });
          return { changes: 1 };
        }
        if (sql.includes('DELETE FROM resources')) {
          if (sql.includes('WHERE id =')) {
            const [id] = params;
            return { changes: this.deleteResource(id) ? 1 : 0 };
          }
          if (sql.includes('WHERE source_id =')) {
            const [source_id] = params;
            return { changes: this.deleteResourcesBySourceId(source_id) };
          }
          if (sql.includes('WHERE created_at < ?')) {
            const [cutoff] = params;
            const initialLength = this.resources.length;
            this.resources = this.resources.filter(resource => {
              if (!resource.created_at) return true;
              return new Date(resource.created_at).getTime() >= new Date(cutoff).getTime();
            });
            this.saveData();
            return { changes: initialLength - this.resources.length };
          }
          if (!sql.includes('WHERE')) {
            const deleted = this.resources.length;
            this.resources = [];
            this.saveData();
            return { changes: deleted };
          }
        }
        if (sql.includes('UPDATE resources')) {
          const [translated_name, subtitle, poster_url, category, description, description_html, id] = params;
          const updated = this.updateResource(id, {
            translated_name: translated_name ?? undefined,
            subtitle: subtitle ?? undefined,
            poster_url: poster_url ?? undefined,
            category: category ?? undefined,
            description: description ?? undefined,
            description_html: description_html ?? undefined,
          });
          return { changes: updated ? 1 : 0 };
        }
        if (sql.includes('UPDATE settings')) {
          const [value, key] = params;
          this.updateSetting(key, value);
          return { changes: 1 };
        }
        return { changes: 1 };
      },
    };
  }
  pragma(_sql: string): void {}

  private loadData(): void {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf-8');
        const state: DatabaseState = JSON.parse(data);
        this.sources = state.sources || [];
        this.sites = (state.sites || []).map(normalizeSite);
        this.resources = (state.resources || []).map(normalizeResource);
        this.settings = state.settings || [];
        this.users = state.users || [];
        this.authSessions = state.authSessions || [];
        this.userData = (state.userData || []).filter(item => hasValidSiteId((item as UserData).site_id, this.sites));
        this.userDataHistory = (state.userDataHistory || []).filter(item =>
          hasValidSiteId((item as UserDataHistory).site_id, this.sites),
        );
        this.sourceIdCounter = state.sourceIdCounter || 1;
        this.siteIdCounter = state.siteIdCounter || 1;
        this.resourceIdCounter = state.resourceIdCounter || 1;
        this.userIdCounter = state.userIdCounter || 1;
        this.userDataIdCounter = state.userDataIdCounter || 1;
        this.userDataHistoryIdCounter = state.userDataHistoryIdCounter || 1;
        console.log(`Loaded data from ${this.dbPath}`);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  private saveData(): void {
    try {
      const state: DatabaseState = {
        sources: this.sources,
        sites: this.sites.map(normalizeSite),
        resources: this.resources,
        settings: this.settings,
        users: this.users,
        authSessions: this.authSessions,
        userData: this.userData,
        userDataHistory: this.userDataHistory,
        sourceIdCounter: this.sourceIdCounter,
        siteIdCounter: this.siteIdCounter,
        resourceIdCounter: this.resourceIdCounter,
        userIdCounter: this.userIdCounter,
        userDataIdCounter: this.userDataIdCounter,
        userDataHistoryIdCounter: this.userDataHistoryIdCounter,
      };
      writeFileSync(this.dbPath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      const result = fn(...args);
      this.saveData();
      return result;
    };
  }

  private ensureDefaultAdmin(): void {
    const existingAdmin = this.getUserByUsername('admin');
    if (existingAdmin) return;
    this.createUser({
      username: 'admin',
      password_hash: hashPassword('admin@123'),
      is_system: 1,
    });
  }
}

const db = new InMemoryDB();
export default db;
