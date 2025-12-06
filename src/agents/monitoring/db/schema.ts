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
}
