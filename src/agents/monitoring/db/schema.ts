import type { Database } from 'bun:sqlite';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  engine TEXT,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'paused')),
  parent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
  pid INTEGER,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration INTEGER,
  prompt TEXT NOT NULL,
  log_path TEXT NOT NULL,
  error TEXT,
  engine_provider TEXT,
  model_name TEXT,
  session_id TEXT,
  accumulated_duration INTEGER DEFAULT 0,
  last_duration_update TEXT,
  pause_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parent_id ON agents(parent_id);
CREATE INDEX IF NOT EXISTS idx_status ON agents(status);

CREATE TABLE IF NOT EXISTS telemetry (
  agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  cost REAL,
  cache_creation_tokens INTEGER,
  cache_read_tokens INTEGER
);
`;

export function initSchema(db: Database): void {
  db.exec(SCHEMA);

  // Migration: Add columns if they don't exist (for existing databases)
  try {
    const tableInfo = db.prepare('PRAGMA table_info(agents)').all() as { name: string }[];
    const columnNames = new Set(tableInfo.map(col => col.name));

    if (!columnNames.has('session_id')) {
      db.exec('ALTER TABLE agents ADD COLUMN session_id TEXT');
    }
    if (!columnNames.has('accumulated_duration')) {
      db.exec('ALTER TABLE agents ADD COLUMN accumulated_duration INTEGER DEFAULT 0');
    }
    if (!columnNames.has('last_duration_update')) {
      db.exec('ALTER TABLE agents ADD COLUMN last_duration_update TEXT');
    }
    if (!columnNames.has('pause_count')) {
      db.exec('ALTER TABLE agents ADD COLUMN pause_count INTEGER DEFAULT 0');
    }
  } catch {
    // Ignore errors - table might not exist yet (will be created by SCHEMA)
  }
}
