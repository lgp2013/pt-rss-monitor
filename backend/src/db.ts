<<<<<<< HEAD
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './data/pt-rss-monitor.db';

// Ensure data directory exists
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT '其他',
    fetch_interval INTEGER DEFAULT 30,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    link TEXT NOT NULL,
    guid TEXT,
    pub_date DATETIME,
    seeders INTEGER DEFAULT 0,
    leechers INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    free_tag TEXT,
    size TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_resources_source_id ON resources(source_id);
  CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at);
  CREATE INDEX IF NOT EXISTS idx_resources_pub_date ON resources(pub_date);
`);

// Insert default settings if not exist
const defaultSettings = [
  ['global_fetch_interval', '30'],
  ['auto_fetch_enabled', 'true'],
  ['theme', 'system'],
  ['resources_retention_days', '30'],
];

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of defaultSettings) {
  insertSetting.run(key, value);
}

=======
// In-memory database with file persistence for development

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

interface Source {
  id: number;
  name: string;
  url: string;
  category: string;
  fetch_interval: number;
  enabled: number;
  created_at: string;
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
}

interface Setting {
  key: string;
  value: string;
}

interface DatabaseState {
  sources: Source[];
  resources: Resource[];
  settings: Setting[];
  sourceIdCounter: number;
  resourceIdCounter: number;
}

class InMemoryDB {
  private sources: Source[] = [];
  private resources: Resource[] = [];
  private settings: Setting[] = [];
  private sourceIdCounter = 1;
  private resourceIdCounter = 1;
  private dbPath: string;

  constructor() {
    // Set database file path
    const dataDir = resolve(process.cwd(), './data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = resolve(dataDir, 'pt-rss-monitor.json');

    // Load data from file if it exists
    this.loadData();

    // Initialize default settings if not exist
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

    // Save initial data
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
    // Also delete associated resources
    this.resources = this.resources.filter(r => r.source_id !== id);
    this.saveData();
    return this.sources.length < initialLength;
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

  // Exec method for compatibility
  exec(sql: string): void {
    // No-op for in-memory implementation
  }

  // Prepare method for compatibility
  prepare(sql: string): any {
    return {
      all: (...params: any[]) => {
        if (sql.includes('SELECT * FROM sources')) {
          return this.sources;
        } else if (sql.includes('FROM resources r JOIN sources s')) {
          // Handle JOIN query for resources with source info
          let filteredResources = this.resources.map(resource => {
            const source = this.sources.find(s => s.id === resource.source_id);
            return {
              ...resource,
              source_name: source?.name || '',
              category: source?.category || ''
            };
          });

          // Apply WHERE clause filters
          if (sql.includes('WHERE')) {
            if (sql.includes('source_id =')) {
              const sourceId = params.find(p => typeof p === 'number');
              if (sourceId) {
                filteredResources = filteredResources.filter(r => r.source_id === sourceId);
              }
            }
            if (sql.includes('category =')) {
              const category = params.find(p => typeof p === 'string');
              if (category) {
                filteredResources = filteredResources.filter(r => r.category === category);
              }
            }
            if (sql.includes('title LIKE')) {
              const search = params.find(p => typeof p === 'string' && p.includes('%'));
              if (search) {
                const searchTerm = search.replace(/%/g, '');
                filteredResources = filteredResources.filter(r => r.title.includes(searchTerm));
              }
            }
          }

          // Apply ORDER BY
          if (sql.includes('ORDER BY')) {
            const match = sql.match(/ORDER BY r\.(\w+)\s+(ASC|DESC)/i);
            if (match) {
              const [, sortColumn, sortOrder] = match;
              const asc = sortOrder.toLowerCase() === 'asc';
              filteredResources.sort((a, b) => {
                let aValue = a[sortColumn as keyof typeof a];
                let bValue = b[sortColumn as keyof typeof b];
                
                // Handle null/undefined - push to end
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return asc ? 1 : -1;
                if (bValue == null) return asc ? -1 : 1;

                // Handle string comparison
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                  return asc ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                }
                // Handle number comparison
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                  return asc ? aValue - bValue : bValue - aValue;
                }
                // Fallback string conversion
                const aStr = String(aValue);
                const bStr = String(bValue);
                return asc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
              });
            }
          }

          // Apply LIMIT and OFFSET - use params array since SQL has ? placeholders
          if (sql.includes('LIMIT')) {
            // LIMIT and OFFSET are the last two params
            const limit = params[params.length - 2];
            const offset = params[params.length - 1];
            if (typeof limit === 'number' && typeof offset === 'number') {
              filteredResources = filteredResources.slice(offset, offset + limit);
            } else {
              // Fallback: try to parse from SQL string
              const limitMatch = sql.match(/LIMIT\s+\?\s+OFFSET\s+\?/);
              if (limitMatch && params.length >= 2) {
                filteredResources = filteredResources.slice(
                  Number(params[params.length - 1]),
                  Number(params[params.length - 1]) + Number(params[params.length - 2])
                );
              }
            }
          }

          return filteredResources;
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
          // Handle resource existence check
          const [sourceId, guid, link] = params;
          const existing = this.resources.find(r => 
            r.source_id === sourceId && (r.guid === guid || r.link === link)
          );
          return existing ? { id: existing.id } : null;
        } else if (sql.includes('SELECT COUNT(*) as total')) {
          // Handle COUNT queries
          if (sql.includes('FROM resources')) {
            let filteredResources = this.resources;
            // Apply filters if present
            if (sql.includes('WHERE')) {
              // Simple filtering based on source_id or category
              if (sql.includes('source_id =')) {
                const sourceId = params.find(p => typeof p === 'number');
                if (sourceId) {
                  filteredResources = filteredResources.filter(r => r.source_id === sourceId);
                }
              }
              if (sql.includes('category =')) {
                const category = params.find(p => typeof p === 'string');
                if (category) {
                  filteredResources = filteredResources.filter(r => {
                    const source = this.sources.find(s => s.id === r.source_id);
                    return source?.category === category;
                  });
                }
              }
              if (sql.includes('title LIKE')) {
                const search = params.find(p => typeof p === 'string' && p.includes('%'));
                if (search) {
                  const searchTerm = search.replace(/%/g, '');
                  filteredResources = filteredResources.filter(r => r.title.includes(searchTerm));
                }
              }
            }
            return { total: filteredResources.length };
          } else if (sql.includes('FROM sources')) {
            return { total: this.sources.length };
          }
          return { total: 0 };
        } else if (sql.includes('SELECT COUNT(*) as count')) {
          // Handle COUNT queries with count alias
          if (sql.includes('FROM sources')) {
            return { count: this.sources.length };
          } else if (sql.includes('FROM resources')) {
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
        } else if (sql.includes('UPDATE sources')) {
          const [name, url, category, fetch_interval, enabled, id] = params;
          this.updateSource(id, { name, url, category, fetch_interval, enabled });
        } else if (sql.includes('DELETE FROM sources')) {
          const [id] = params;
          this.deleteSource(id);
        } else if (sql.includes('INSERT INTO resources')) {
          const [source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size] = params;
          this.addResource({ source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size });
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
  pragma(sql: string): void {
    // No-op for in-memory implementation
  }

  // Load data from file
  private loadData(): void {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf-8');
        const state: DatabaseState = JSON.parse(data);
        this.sources = state.sources || [];
        this.resources = state.resources || [];
        this.settings = state.settings || [];
        this.sourceIdCounter = state.sourceIdCounter || 1;
        this.resourceIdCounter = state.resourceIdCounter || 1;
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
        sourceIdCounter: this.sourceIdCounter,
        resourceIdCounter: this.resourceIdCounter,
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
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
export default db;
