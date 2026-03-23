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
// In-memory database implementation for development
class InMemoryDB {
    sources = [];
    resources = [];
    settings = [];
    sourceIdCounter = 1;
    resourceIdCounter = 1;
    constructor() {
        // Initialize default settings
        const defaultSettings = [
            { key: 'global_fetch_interval', value: '30' },
            { key: 'auto_fetch_enabled', value: 'true' },
            { key: 'theme', value: 'system' },
            { key: 'resources_retention_days', value: '30' },
        ];
        this.settings = defaultSettings;
    }
    // Sources
    allSources() {
        return this.sources;
    }
    getSource(id) {
        return this.sources.find(s => s.id === id);
    }
    addSource(source) {
        const newSource = {
            ...source,
            id: this.sourceIdCounter++,
            created_at: new Date().toISOString(),
        };
        this.sources.push(newSource);
        return newSource;
    }
    updateSource(id, updates) {
        const index = this.sources.findIndex(s => s.id === id);
        if (index === -1)
            return undefined;
        this.sources[index] = { ...this.sources[index], ...updates };
        return this.sources[index];
    }
    deleteSource(id) {
        const initialLength = this.sources.length;
        this.sources = this.sources.filter(s => s.id !== id);
        // Also delete associated resources
        this.resources = this.resources.filter(r => r.source_id !== id);
        return this.sources.length < initialLength;
    }
    // Resources
    allResources() {
        return this.resources;
    }
    getResource(id) {
        return this.resources.find(r => r.id === id);
    }
    addResource(resource) {
        const newResource = {
            ...resource,
            id: this.resourceIdCounter++,
            created_at: new Date().toISOString(),
        };
        this.resources.push(newResource);
        return newResource;
    }
    deleteResource(id) {
        const initialLength = this.resources.length;
        this.resources = this.resources.filter(r => r.id !== id);
        return this.resources.length < initialLength;
    }
    deleteResourcesBySourceId(sourceId) {
        const initialLength = this.resources.length;
        this.resources = this.resources.filter(r => r.source_id !== sourceId);
        return initialLength - this.resources.length;
    }
    // Settings
    allSettings() {
        return this.settings;
    }
    getSetting(key) {
        return this.settings.find(s => s.key === key);
    }
    updateSetting(key, value) {
        const index = this.settings.findIndex(s => s.key === key);
        if (index === -1) {
            const newSetting = { key, value };
            this.settings.push(newSetting);
            return newSetting;
        }
        this.settings[index].value = value;
        return this.settings[index];
    }
    // Exec method for compatibility
    exec(sql) {
        // No-op for in-memory implementation
    }
    // Prepare method for compatibility
    prepare(sql) {
        return {
            all: (...params) => {
                if (sql.includes('SELECT * FROM sources')) {
                    return this.sources;
                }
                else if (sql.includes('SELECT * FROM resources')) {
                    return this.resources;
                }
                else if (sql.includes('SELECT * FROM settings')) {
                    return this.settings;
                }
                return [];
            },
            get: (...params) => {
                if (sql.includes('SELECT value FROM settings WHERE key =')) {
                    const key = params[0];
                    return { value: this.getSetting(key)?.value };
                }
                else if (sql.includes('SELECT * FROM sources WHERE id =')) {
                    const id = params[0];
                    return this.getSource(id);
                }
                else if (sql.includes('SELECT * FROM resources WHERE id =')) {
                    const id = params[0];
                    return this.getResource(id);
                }
                return null;
            },
            run: (...params) => {
                if (sql.includes('INSERT INTO sources')) {
                    const [name, url, category, fetch_interval, enabled] = params;
                    this.addSource({ name, url, category, fetch_interval, enabled });
                    return { lastInsertRowid: this.sourceIdCounter - 1 };
                }
                else if (sql.includes('UPDATE sources')) {
                    const [name, url, category, fetch_interval, enabled, id] = params;
                    this.updateSource(id, { name, url, category, fetch_interval, enabled });
                }
                else if (sql.includes('DELETE FROM sources')) {
                    const [id] = params;
                    this.deleteSource(id);
                }
                else if (sql.includes('INSERT INTO resources')) {
                    const [source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size] = params;
                    this.addResource({ source_id, title, link, guid, pub_date, seeders, leechers, downloads, free_tag, size });
                }
                else if (sql.includes('DELETE FROM resources')) {
                    if (sql.includes('WHERE id =')) {
                        const [id] = params;
                        this.deleteResource(id);
                    }
                    else if (sql.includes('WHERE source_id =')) {
                        const [source_id] = params;
                        this.deleteResourcesBySourceId(source_id);
                    }
                }
                else if (sql.includes('UPDATE settings')) {
                    const [value, key] = params;
                    this.updateSetting(key, value);
                }
                return { changes: 1 };
            },
        };
    }
    // Pragma method for compatibility
    pragma(sql) {
        // No-op for in-memory implementation
    }
    // Transaction method for compatibility
    transaction(fn) {
        return (...args) => fn(...args);
    }
}
const db = new InMemoryDB();
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
export default db;
