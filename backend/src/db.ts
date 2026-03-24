// In-memory database with file persistence for development

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface Source {
  id: number;
  name: string;
  url: string;
  category: string;
  fetch_interval: number;
  enabled: number;
  created_at: string;
  cookie?: string;
  cookies?: Record<string, string>;
}

interface Resource {
  id: number;
  source_id: number;
  title: string;
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
}

interface Setting {
  key: string;
  value: string;
}

interface SearchSnapshot {
  id: number;
  name: string;
  query: string;
  filters: string;
  result_ids: number[];
  source_ids: number[];
  created_at: string;
}

interface FetchHistory {
  id: number;
  source_id: number;
  source_name: string;
  status: 'success' | 'error';
  message: string;
  new_resources: number;
  fetched_at: string;
}

interface KeywordRule {
  id: number;
  name: string;
  keywords: string[];         // 关键词列表，AND 关系
  exclude: string[];          // 排除词，匹配则跳过
  source_ids: number[];       // 针对哪些源，[] 表示全部
  enabled: boolean;
  created_at: string;
  last_matched_at: string | null;
  match_count: number;
}

interface DatabaseState {
  sources: Source[];
  resources: Resource[];
  settings: Setting[];
  searchSnapshots: SearchSnapshot[];
  fetchHistories: FetchHistory[];
  keywordRules: KeywordRule[];
  sourceIdCounter: number;
  resourceIdCounter: number;
  snapshotIdCounter: number;
  fetchHistoryIdCounter: number;
}

class InMemoryDB {
  private sources: Source[] = [];
  private resources: Resource[] = [];
  private settings: Setting[] = [];
  private searchSnapshots: SearchSnapshot[] = [];
  private fetchHistories: FetchHistory[] = [];
  private keywordRules: KeywordRule[] = [];
  private sourceIdCounter = 1;
  private resourceIdCounter = 1;
  private snapshotIdCounter = 1;
  private fetchHistoryIdCounter = 1;
  private keywordRuleIdCounter = 1;
  private dbPath: string;

  constructor() {
    const dbPathEnv = process.env.DB_PATH;
    if (dbPathEnv) {
      this.dbPath = dbPathEnv;
    } else {
      const dataDir = resolve(process.cwd(), './data');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = resolve(dataDir, 'pt-rss-monitor.json');
    }

    this.loadData();

    const defaultSettings = [
      { key: 'global_fetch_interval', value: '30' },
      { key: 'auto_fetch_enabled', value: 'true' },
      { key: 'theme', value: 'system' },
      { key: 'resources_retention_days', value: '30' },
    ];

    for (const setting of defaultSettings) {
      if (!this.settings.some(s => s.key === setting.key)) {
        this.settings.push(setting);
      }
    }

    this.saveData();
  }

  // Sources
  allSources(): Source[] {
    return this.sources;
  }

  getSource(id: number): Source | undefined {
    return this.sources.find(s => s.id === id);
  }

  addSource(source: Omit<Source, 'id' | 'created_at'>): Source {
    const newSource: Source = {
      ...source,
      id: this.sourceIdCounter++,
      created_at: new Date().toISOString(),
    };
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

  deleteSources(ids: number[]): number {
    const initialLength = this.sources.length;
    this.sources = this.sources.filter(s => !ids.includes(s.id));
    this.resources = this.resources.filter(r => !ids.includes(r.source_id));
    this.saveData();
    return initialLength - this.sources.length;
  }

  // Resources
  allResources(): Resource[] {
    return this.resources;
  }

  getResource(id: number): Resource | undefined {
    return this.resources.find(r => r.id === id);
  }

  addResource(resource: Omit<Resource, 'id' | 'created_at'>): Resource {
    const newResource: Resource = {
      ...resource,
      id: this.resourceIdCounter++,
      created_at: new Date().toISOString(),
    };
    this.resources.push(newResource);
    this.saveData();
    return newResource;
  }

  deleteResource(id: number): boolean {
    const initialLength = this.resources.length;
    this.resources = this.resources.filter(r => r.id !== id);
    this.saveData();
    return this.resources.length < initialLength;
  }

  deleteResources(ids: number[]): number {
    const initialLength = this.resources.length;
    this.resources = this.resources.filter(r => !ids.includes(r.id));
    this.saveData();
    return initialLength - this.resources.length;
  }

  deleteResourcesBySourceId(sourceId: number): number {
    const initialLength = this.resources.length;
    this.resources = this.resources.filter(r => r.source_id !== sourceId);
    this.saveData();
    return initialLength - this.resources.length;
  }

  // Settings
  allSettings(): Setting[] {
    return this.settings;
  }

  getSetting(key: string): Setting | undefined {
    return this.settings.find(s => s.key === key);
  }

  updateSetting(key: string, value: string): Setting {
    const index = this.settings.findIndex(s => s.key === key);
    if (index === -1) {
      const newSetting: Setting = { key, value };
      this.settings.push(newSetting);
    } else {
      this.settings[index].value = value;
    }
    this.saveData();
    return this.settings.find(s => s.key === key) as Setting;
  }

  // Search Snapshots
  allSnapshots(): SearchSnapshot[] {
    return this.searchSnapshots;
  }

  getSnapshot(id: number): SearchSnapshot | undefined {
    return this.searchSnapshots.find(s => s.id === id);
  }

  addSnapshot(snapshot: Omit<SearchSnapshot, 'id' | 'created_at'>): SearchSnapshot {
    const newSnapshot: SearchSnapshot = {
      ...snapshot,
      id: this.snapshotIdCounter++,
      created_at: new Date().toISOString(),
    };
    this.searchSnapshots.push(newSnapshot);
    this.saveData();
    return newSnapshot;
  }

  deleteSnapshot(id: number): boolean {
    const initialLength = this.searchSnapshots.length;
    this.searchSnapshots = this.searchSnapshots.filter(s => s.id !== id);
    this.saveData();
    return this.searchSnapshots.length < initialLength;
  }

  // Fetch Histories
  allFetchHistories(): FetchHistory[] {
    return this.fetchHistories;
  }

  addFetchHistory(history: Omit<FetchHistory, 'id'>): FetchHistory {
    const newHistory: FetchHistory = {
      ...history,
      id: this.fetchHistoryIdCounter++,
    };
    this.fetchHistories.push(newHistory);
    // Keep only last 500 histories
    if (this.fetchHistories.length > 500) {
      this.fetchHistories = this.fetchHistories.slice(-500);
    }
    this.saveData();
    return newHistory;
  }

  deleteFetchHistoriesBySourceId(sourceId: number): number {
    const initialLength = this.fetchHistories.length;
    this.fetchHistories = this.fetchHistories.filter(h => h.source_id !== sourceId);
    this.saveData();
    return initialLength - this.fetchHistories.length;
  }

  // Keyword Rules
  allKeywordRules(): KeywordRule[] {
    return this.keywordRules;
  }

  getKeywordRule(id: number): KeywordRule | undefined {
    return this.keywordRules.find(r => r.id === id);
  }

  addKeywordRule(rule: Omit<KeywordRule, 'id' | 'created_at' | 'last_matched_at' | 'match_count'>): KeywordRule {
    const newRule: KeywordRule = {
      ...rule,
      id: this.keywordRuleIdCounter++,
      created_at: new Date().toISOString(),
      last_matched_at: null,
      match_count: 0,
    };
    this.keywordRules.push(newRule);
    this.saveData();
    return newRule;
  }

  updateKeywordRule(id: number, updates: Partial<KeywordRule>): KeywordRule | undefined {
    const index = this.keywordRules.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    this.keywordRules[index] = { ...this.keywordRules[index], ...updates };
    this.saveData();
    return this.keywordRules[index];
  }

  deleteKeywordRule(id: number): boolean {
    const initialLength = this.keywordRules.length;
    this.keywordRules = this.keywordRules.filter(r => r.id !== id);
    this.saveData();
    return this.keywordRules.length < initialLength;
  }

  // Match a resource against keyword rules, returns matched rules
  matchKeywordRules(resource: { title: string; source_id: number; link?: string }): KeywordRule[] {
    const matched: KeywordRule[] = [];
    for (const rule of this.keywordRules) {
      if (!rule.enabled) continue;
      // Check source filter
      if (rule.source_ids.length > 0 && !rule.source_ids.includes(resource.source_id)) continue;
      // Check exclude words
      const text = (resource.title + ' ' + (resource.link || '')).toLowerCase();
      const isExcluded = rule.exclude.some(kw => text.includes(kw.toLowerCase()));
      if (isExcluded) continue;
      // Check include keywords (AND: all must match)
      const allMatch = rule.keywords.every(kw => text.includes(kw.toLowerCase()));
      if (allMatch) {
        rule.match_count++;
        rule.last_matched_at = new Date().toISOString();
        matched.push(rule);
      }
    }
    if (matched.length > 0) this.saveData();
    return matched;
  }

  // Exec method for compatibility
  exec(sql: string): void {}

  // Prepare method for compatibility
  prepare(sql: string): any {
    return {
      all: (...params: any[]) => {
        if (sql.includes('SELECT r.')) {
          if (sql.includes('JOIN sources s')) {
            let results = this.resources.map(r => {
              const src = this.sources.find(s => s.id === r.source_id);
              return {
                ...r,
                source_name: src?.name || '',
                category: r.category || src?.category || ''
              };
            });

            const hasSourceIdFilter = sql.includes('r.source_id = ?');
            const hasCategoryFilter = sql.includes('s.category = ?');
            const hasSearchFilter = sql.includes('title LIKE ?');

            let paramIdx = 0;

            if (hasSourceIdFilter && params[paramIdx] !== undefined && params[paramIdx] !== null) {
              const sid = Number(params[paramIdx]);
              if (!isNaN(sid)) {
                results = results.filter(r => r.source_id === sid);
              }
            }
            paramIdx++;

            if (hasCategoryFilter && params[paramIdx] !== undefined && params[paramIdx] !== null) {
              const cat = String(params[paramIdx]);
              if (cat) {
                results = results.filter(r => r.category === cat);
              }
            }
            paramIdx++;

            if (hasSearchFilter && params[paramIdx] !== undefined && params[paramIdx] !== null) {
              const search = String(params[paramIdx]).replace(/%/g, '');
              if (search) {
                results = results.filter(r => r.title.toLowerCase().includes(search.toLowerCase()));
              }
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
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                  return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                return asc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
              });
            }

            if (params.length >= 2) {
              const limit = Number(params[params.length - 2]);
              const offset = Number(params[params.length - 1]);
              if (!isNaN(limit) && !isNaN(offset)) {
                results = results.slice(offset, offset + limit);
              }
            }
            return results;
          }
        } else if (sql.includes('SELECT * FROM sources')) {
          return this.sources;
        } else if (sql.includes('SELECT * FROM resources')) {
          return this.resources;
        } else if (sql.includes('SELECT * FROM settings')) {
          return this.settings;
        } else if (sql.includes('SELECT * FROM sources WHERE enabled = 1')) {
          return this.sources.filter(source => source.enabled === 1);
        }
        return [];
      },
      get: (...params: any[]) => {
        if (sql.includes('SELECT value FROM settings WHERE key =')) {
          const key = params[0];
          return { value: this.getSetting(key)?.value };
        } else if (sql.includes('SELECT * FROM sources WHERE id =')) {
          const id = params[0];
          return this.getSource(id);
        } else if (sql.includes('SELECT * FROM resources WHERE id =')) {
          const id = params[0];
          return this.getResource(id);
        } else if (sql.includes('SELECT id FROM resources WHERE source_id = ? AND (guid = ? OR link = ?)')) {
          const [sourceId, guid, link] = params;
          const existing = this.resources.find(r =>
            r.source_id === sourceId && (r.guid === guid || r.link === link)
          );
          return existing ? { id: existing.id } : null;
        } else if (sql.includes('SELECT COUNT(*) as total')) {
          if (sql.includes('FROM resources')) {
            let filteredResources = this.resources;
            if (sql.includes('source_id =')) {
              const sourceId = params.find(p => typeof p === 'number');
              if (sourceId) {
                filteredResources = filteredResources.filter(r => r.source_id === sourceId);
              }
            }
            return { total: filteredResources.length };
          } else if (sql.includes('FROM sources')) {
            return { total: this.sources.length };
          }
          return { total: 0 };
        } else if (sql.includes('SELECT COUNT(*) as count')) {
          if (sql.includes('FROM sources')) {
            return { count: this.sources.length };
          } else if (sql.includes('FROM resources')) {
            if (sql.includes('created_at >=')) {
              const dateStr = params[0];
              if (dateStr) {
                const date = new Date(dateStr);
                const filtered = this.resources.filter(r => {
                  const created = new Date(r.created_at);
                  return created >= date;
                });
                return { count: filtered.length };
              }
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
        } else if (sql.includes('INSERT INTO settings')) {
          const [key, value] = params;
          const existingIndex = this.settings.findIndex(s => s.key === key);
          if (existingIndex >= 0) {
            this.settings[existingIndex].value = value;
          } else {
            this.settings.push({ key, value });
          }
          return { lastInsertRowid: 0 };
        } else if (sql.includes('UPDATE sources')) {
          const [name, url, category, fetch_interval, enabled, id] = params;
          this.updateSource(id, { name, url, category, fetch_interval, enabled });
        } else if (sql.includes('DELETE FROM sources')) {
          const [id] = params;
          this.deleteSource(id);
        } else if (sql.includes('INSERT INTO resources')) {
          const [source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size, subtitle, poster_url, category, description] = params;
          this.addResource({ source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size, subtitle, poster_url, category, description });
        } else if (sql.includes('DELETE FROM resources')) {
          if (sql.includes('WHERE id =')) {
            const [id] = params;
            this.deleteResource(id);
          } else if (sql.includes('WHERE source_id =')) {
            const [source_id] = params;
            this.deleteResourcesBySourceId(source_id);
          }
        } else if (sql.includes('UPDATE settings')) {
          const [value, key] = params;
          this.updateSetting(key, value);
        }
        return { changes: 1 };
      },
    };
  }

  // Pragma method for compatibility
  pragma(sql: string): void {}

  // Load data from file
  private loadData(): void {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf-8');
        const state: DatabaseState = JSON.parse(data);
        this.sources = state.sources || [];
        this.resources = state.resources || [];
        this.settings = state.settings || [];
        this.searchSnapshots = state.searchSnapshots || [];
        this.fetchHistories = state.fetchHistories || [];
        this.keywordRules = state.keywordRules || [];
        this.sourceIdCounter = state.sourceIdCounter || 1;
        this.resourceIdCounter = state.resourceIdCounter || 1;
        this.snapshotIdCounter = state.snapshotIdCounter || 1;
        this.fetchHistoryIdCounter = state.fetchHistoryIdCounter || 1;
        this.keywordRuleIdCounter = state.keywordRuleIdCounter || 1;
        console.log(`Loaded data from ${this.dbPath}`);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Save data to file
  private saveData(): void {
    try {
      const state: DatabaseState = {
        sources: this.sources,
        resources: this.resources,
        settings: this.settings,
        searchSnapshots: this.searchSnapshots,
        fetchHistories: this.fetchHistories,
        keywordRules: this.keywordRules,
        sourceIdCounter: this.sourceIdCounter,
        resourceIdCounter: this.resourceIdCounter,
        snapshotIdCounter: this.snapshotIdCounter,
        fetchHistoryIdCounter: this.fetchHistoryIdCounter,
        keywordRuleIdCounter: this.keywordRuleIdCounter,
      };
      writeFileSync(this.dbPath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  // Transaction method for compatibility
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      const result = fn(...args);
      this.saveData();
      return result;
    };
  }
}

const db = new InMemoryDB();
export default db;
