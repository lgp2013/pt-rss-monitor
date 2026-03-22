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

export default db;
